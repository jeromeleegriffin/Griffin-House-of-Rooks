package com.griffin.rookinstaller

import android.app.*
import android.os.*
import android.content.*
import android.net.Uri
import android.provider.DocumentsContract
import android.view.*
import android.widget.*
import java.io.*
import java.util.zip.ZipInputStream

class MainActivity : Activity() {
    private lateinit var status: TextView
    private val prefs by lazy { getSharedPreferences("rook", MODE_PRIVATE) }
    private var incoming: Uri? = null
    private val PICK_ROOT = 20

    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        val box = LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(48,64,48,48) }
        box.addView(TextView(this).apply { text="GRIFFIN ROOK INSTALLER"; textSize=24f })
        status=TextView(this).apply { textSize=17f; setPadding(0,30,0,30) }; box.addView(status)
        fun button(t:String, f:()->Unit)=Button(this).also { it.text=t; it.setOnClickListener{f()}; box.addView(it) }
        button("CHOOSE ROOK STORAGE FOLDER") { chooseRoot() }
        button("CHOOSE ROOK ZIP") { startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT).apply{addCategory(Intent.CATEGORY_OPENABLE);type="application/zip"},21) }
        button("INSTALL SELECTED BUILD") { incoming?.let{install(it)} ?: toast("Choose or share a ZIP first") }
        setContentView(box)
        incoming = when(intent.action){ Intent.ACTION_SEND -> intent.getParcelableExtra(Intent.EXTRA_STREAM); Intent.ACTION_VIEW -> intent.data; else -> null }
        refresh()
    }

    private fun refresh(){
        val root=prefs.getString("root",null)
        status.text = (if(root==null) "First: choose a storage folder (Downloads is fine).\nThe app will create/use Rook and RookZips inside it." else "Storage selected.\nRook = current extracted build\nRookZips = permanent ZIP archive") + (if(incoming!=null) "\n\nZIP selected and ready to validate/install." else "")
    }
    private fun chooseRoot(){ startActivityForResult(Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply{addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)},PICK_ROOT) }
    override fun onActivityResult(r:Int,c:Int,d:Intent?){ super.onActivityResult(r,c,d); if(c!=RESULT_OK||d?.data==null)return; val u=d.data!!; if(r==PICK_ROOT){ contentResolver.takePersistableUriPermission(u, Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION); prefs.edit().putString("root",u.toString()).apply(); refresh() } else if(r==21){ incoming=u; refresh() } }

    private fun install(zipUri:Uri){
        val root=prefs.getString("root",null)?.let(Uri::parse) ?: return toast("Choose the storage folder first")
        Thread {
            try {
                // Validate before destructive work: must be a full build with index.html, not an update pack.
                var hasIndex=false; var hasGame=false
                contentResolver.openInputStream(zipUri)!!.use { raw -> ZipInputStream(BufferedInputStream(raw)).use { z -> while(true){ val e=z.nextEntry?:break; val n=e.name.substringAfterLast('/'); if(n=="index.html")hasIndex=true; if(n=="game.js")hasGame=true } } }
                if(!hasIndex || !hasGame) throw Exception("Not a full Rook build (index.html/game.js missing). Nothing changed.")
                val rootDoc=androidx.documentfile.provider.DocumentFile.fromTreeUri(this,root) ?: throw Exception("Storage folder unavailable")
                val zips=rootDoc.findFile("RookZips") ?: rootDoc.createDirectory("RookZips")!!
                val tmp=rootDoc.findFile("Rook_NEW")?.also{it.delete()} ?: rootDoc.createDirectory("Rook_NEW")!!
                unzipInto(zipUri,tmp)
                if(findRecursive(tmp,"index.html")==null) throw Exception("Extracted build has no index.html. Old Rook preserved.")
                rootDoc.findFile("Rook")?.delete()
                val rook=rootDoc.createDirectory("Rook")!!
                copyTree(tmp,rook); tmp.delete()
                val name=queryName(zipUri) ?: "RookBuild_${System.currentTimeMillis()}.zip"
                if(zips.findFile(name)==null){ val out=zips.createFile("application/zip",name)!!; contentResolver.openInputStream(zipUri)!!.use{a->contentResolver.openOutputStream(out.uri)!!.use{b->a.copyTo(b)}} }
                runOnUiThread{ status.text="READY — $name\nInstalled to Rook/\nOriginal ZIP preserved in RookZips/" }
            } catch(e:Exception){ runOnUiThread{status.text="INSTALL STOPPED\n${e.message}"} }
        }.start()
    }
    private fun unzipInto(uri:Uri, dest:androidx.documentfile.provider.DocumentFile){
        contentResolver.openInputStream(uri)!!.use { raw -> ZipInputStream(BufferedInputStream(raw)).use { z -> while(true){ val e=z.nextEntry?:break; val parts=e.name.trim('/').split('/').filter{it.isNotBlank()}; if(parts.isEmpty())continue; var dir=dest; for(p in parts.dropLast(1)){ dir=dir.findFile(p)?:dir.createDirectory(p)!! }; if(!e.isDirectory){ val f=dir.createFile("application/octet-stream",parts.last())!!; contentResolver.openOutputStream(f.uri)!!.use{z.copyTo(it)} } } } }
    }
    private fun copyTree(src:androidx.documentfile.provider.DocumentFile,dst:androidx.documentfile.provider.DocumentFile){ for(f in src.listFiles()){ if(f.isDirectory){ val d=dst.createDirectory(f.name!!)!!; copyTree(f,d) } else { val o=dst.createFile(f.type?:"application/octet-stream",f.name!!)!!; contentResolver.openInputStream(f.uri)!!.use{a->contentResolver.openOutputStream(o.uri)!!.use{b->a.copyTo(b)}} } } }
    private fun findRecursive(d:androidx.documentfile.provider.DocumentFile,n:String):androidx.documentfile.provider.DocumentFile?{ d.findFile(n)?.let{return it}; for(f in d.listFiles()) if(f.isDirectory) findRecursive(f,n)?.let{return it}; return null }
    private fun queryName(u:Uri):String? { contentResolver.query(u,arrayOf(android.provider.OpenableColumns.DISPLAY_NAME),null,null,null)?.use{ if(it.moveToFirst())return it.getString(0)}; return null }
    private fun toast(s:String)=Toast.makeText(this,s,Toast.LENGTH_LONG).show()
}

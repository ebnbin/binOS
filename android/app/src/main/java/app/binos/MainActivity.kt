package app.binos

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.binos.shell.ConnectScreen
import app.binos.shell.LoginScreen
import app.binos.shell.MainScreen
import app.binos.ui.theme.BinOSTheme
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

var debugOpen: String? = null

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        // 调试版可以用 adb 直接指定要连的测试实例：am start -n app.binos/.MainActivity --es server http://10.0.2.2:端口
        if (BuildConfig.DEBUG) intent.getStringExtra("server")?.toHttpUrlOrNull()?.let { app.server.connect(it); app.events.restart() }
        // 调试版也可以直接打开 Mac 上的一个文件或目录：--es open /绝对路径
        if (BuildConfig.DEBUG && savedInstanceState == null) debugOpen = intent.getStringExtra("open")
        setContent {
            BinOSTheme {
                val url by app.server.url.collectAsStateWithLifecycle()
                val authRequired by app.api.authRequired.collectAsStateWithLifecycle()
                val current = url
                when {
                    current == null -> ConnectScreen()
                    authRequired -> LoginScreen(current)
                    else -> MainScreen()
                }
            }
        }
    }
}

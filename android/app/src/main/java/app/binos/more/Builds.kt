@file:OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)

package app.binos.more

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import app.binos.app
import app.binos.code.encode
import app.binos.code.parseTime
import app.binos.shell.BuildLogRoute
import app.binos.shell.LocalNav
import app.binos.ui.codeStyle
import app.binos.ui.download
import app.binos.ui.formatBytes
import app.binos.ui.formatDuration
import app.binos.ui.formatFull
import app.binos.ui.rememberNow
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.add
import okhttp3.Request

// 和 server/src/apps/builds/types.ts 对应

@Serializable
data class Artifact(val name: String, val size: Long, val sha256: String = "")

@Serializable
data class Build(
    val id: String,
    val commit: String,
    val target: String,
    val trigger: String,
    val pr: Int? = null,
    val status: String,
    val createdAt: String,
    val startedAt: String? = null,
    val endedAt: String? = null,
    val error: String? = null,
    val artifacts: List<Artifact> = emptyList(),
)

@Serializable
data class BuildSettings(val automatic: Boolean = false, val adhoc: Boolean = false)

@Serializable
data class BuildsSnapshot(val builds: List<Build> = emptyList(), val settings: BuildSettings = BuildSettings(), val pollError: String? = null, val checkedAt: String? = null, val mode: String = "real")

private const val base = "/api/apps/builds"
private val targetLabels = mapOf("android" to "Android APK", "ios-simulator" to "iOS 模拟器", "ios-adhoc" to "iOS Ad Hoc")
private val statusLabels = mapOf("queued" to "排队中", "running" to "构建中", "success" to "成功", "failed" to "失败", "cancelled" to "已取消", "interrupted" to "已中断")

// 移动端的持续集成：构建列表、手动构建、日志和产物。Android 的 APK 可以直接下载安装
@Composable
fun BuildsScreen() {
    val nav = LocalNav.current
    val context = LocalContext.current
    var data by remember { mutableStateOf<BuildsSnapshot?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var ref by rememberSaveable { mutableStateOf("main") }
    var targets by rememberSaveable { mutableStateOf(setOf("android", "ios-simulator")) }
    var filter by rememberSaveable { mutableStateOf("all") }
    val scope = rememberCoroutineScope()
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val now = rememberNow(intervalMs = 1000)
    LaunchedEffect(Unit) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                runCatching { app.api.get<BuildsSnapshot>(base) }.onSuccess { data = it; error = null }.onFailure { error = it.message }
                delay(4000)
            }
        }
    }
    fun act(body: JsonElement) {
        busy = true
        scope.launch {
            runCatching { app.api.send("POST", base, body, BuildsSnapshot.serializer()) }.onSuccess { data = it; error = null }.onFailure { error = it.message }
            busy = false
        }
    }
    Scaffold(
        topBar = {
            BackBar("构建") {
                IconButton(onClick = { act(buildJsonObject { put("action", "poll") }) }, enabled = !busy) { Icon(Icons.Outlined.Sync, "检查更新") }
            }
        },
    ) { padding ->
        LazyColumn(Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (data?.mode == "mock") item { Text("预览模式：模拟构建，与正式构建及签名隔离。", color = MaterialTheme.colorScheme.tertiary) }
            error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
            data?.pollError?.let { item { Text("检查仓库失败：$it", color = MaterialTheme.colorScheme.error) } }
            data?.let { snapshot ->
                item {
                    Column {
                        ListItem(headlineContent = { Text("自动构建 main 和 PR") }, trailingContent = {
                            Switch(snapshot.settings.automatic, enabled = !busy, onCheckedChange = { act(settingsBody(it, snapshot.settings.adhoc)) })
                        })
                        ListItem(headlineContent = { Text("自动构建 Ad Hoc") }, supportingContent = { Text("需要签名证书及已注册设备") }, trailingContent = {
                            Switch(snapshot.settings.adhoc, enabled = !busy, onCheckedChange = { act(settingsBody(snapshot.settings.automatic, it)) })
                        })
                        snapshot.checkedAt?.let { Text("上次检查：${formatFull(parseTime(it))}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 16.dp)) }
                    }
                }
            }
            item {
                ElevatedCard {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("手动构建", style = MaterialTheme.typography.titleMedium)
                        OutlinedTextField(ref, { ref = it }, label = { Text("构建来源") }, placeholder = { Text("main、pr/编号、完整提交号") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            targetLabels.forEach { (target, label) ->
                                FilterChip(target in targets, onClick = { targets = if (target in targets) targets - target else targets + target }, label = { Text(label) })
                            }
                        }
                        Button(
                            onClick = {
                                act(buildJsonObject {
                                    put("action", "enqueue")
                                    put("ref", ref.trim())
                                    putJsonArray("targets") { targets.forEach { add(it) } }
                                })
                            },
                            enabled = !busy && data != null && ref.isNotBlank() && targets.isNotEmpty(),
                        ) { Text("开始构建") }
                    }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("all" to "全部", "main" to "main", "pr" to "PR", "manual" to "手动").forEach { (key, label) ->
                        FilterChip(filter == key, onClick = { filter = key }, label = { Text(label) })
                    }
                }
            }
            val builds = data?.builds.orEmpty().filter { filter == "all" || it.trigger == filter }
            if (data == null) item { CircularProgressIndicator() }
            else if (builds.isEmpty()) item { Text("暂无构建", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(builds, key = { it.id }) { build ->
                ElevatedCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(targetLabels[build.target] ?: build.target, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                            Text(
                                statusLabels[build.status] ?: build.status,
                                color = when (build.status) {
                                    "success" -> MaterialTheme.colorScheme.primary
                                    "failed", "interrupted" -> MaterialTheme.colorScheme.error
                                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                                },
                                style = MaterialTheme.typography.labelLarge,
                            )
                        }
                        Text(
                            listOfNotNull(
                                build.commit.take(7),
                                when (build.trigger) {
                                    "pr" -> "PR #${build.pr}"
                                    "manual" -> "手动"
                                    else -> "main"
                                },
                                formatFull(parseTime(build.createdAt)),
                                build.startedAt?.let { "用时 ${formatDuration((build.endedAt?.let(::parseTime) ?: now) - parseTime(it))}" },
                            ).joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        build.error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            TextButton(onClick = { nav.navigate(BuildLogRoute(build.id)) }) { Text("查看日志") }
                            if (build.status == "queued" || build.status == "running") {
                                TextButton(onClick = { act(buildJsonObject { put("action", "cancel"); put("id", build.id) }) }, enabled = !busy) { Text("取消") }
                            } else {
                                TextButton(onClick = { act(buildJsonObject { put("action", "retry"); put("id", build.id) }) }, enabled = !busy) { Text("重新构建") }
                            }
                        }
                        build.artifacts.forEach { artifact ->
                            AssistChip(
                                onClick = {
                                    download(context, app.api.url("$base/${build.id}/artifacts/${encode(artifact.name)}").toString(), artifact.name)
                                },
                                label = { Text("${artifact.name} · ${formatBytes(artifact.size)}") },
                                leadingIcon = { Icon(Icons.Outlined.Download, null) },
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun settingsBody(automatic: Boolean, adhoc: Boolean) = buildJsonObject {
    put("action", "settings")
    put("automatic", automatic)
    put("adhoc", adhoc)
}

// 构建日志的末尾，每 2 秒刷新；新内容出现时滚到底部
@Composable
fun BuildLogScreen(id: String) {
    val context = LocalContext.current
    var text by remember { mutableStateOf("读取日志…") }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(id) {
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            while (true) {
                runCatching { app.api.text(Request.Builder().url(app.api.url("$base/${encode(id)}/log")).build()) }.onSuccess { text = it }.onFailure { text = it.message ?: "日志读取失败" }
                delay(2000)
            }
        }
    }
    val lines = remember(text) { text.lines() }
    val list = rememberLazyListState()
    LaunchedEffect(lines.size) { if (lines.isNotEmpty()) list.scrollToItem(lines.size - 1) }
    Scaffold(
        topBar = {
            BackBar("构建日志") {
                IconButton(onClick = { download(context, app.api.url("$base/${encode(id)}/log?download=1").toString(), "build-$id.log") }) { Icon(Icons.Outlined.Download, "下载完整日志") }
            }
        },
    ) { padding ->
        SelectionContainer(Modifier.fillMaxSize().padding(padding)) {
            LazyColumn(state = list, modifier = Modifier.fillMaxSize(), contentPadding = PaddingValues(12.dp)) {
                items(lines.size) { index -> Text(lines[index], style = codeStyle.copy(fontFamily = FontFamily.Monospace)) }
            }
        }
    }
}

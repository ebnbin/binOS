package app.binos.code

import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import app.binos.net.Api
import app.binos.net.ApiException
import app.binos.net.StreamSignal
import app.binos.net.eventStream
import app.binos.net.json
import app.binos.net.octetType
import kotlinx.coroutines.flow.Flow
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.addJsonObject
import okhttp3.MediaType
import okhttp3.RequestBody
import okio.BufferedSink
import okio.source
import java.net.URLEncoder

// 正在回答时：插话（agent 在下一步看到）、先打断再说、排到这一轮答完之后
enum class SendMode { Send, Interrupt, Queue }

// 下一轮用的 agent、模型和思考程度；agent 只在新对话时能选
data class Choice(val agent: String, val model: String? = null, val effort: String? = null)

@Serializable
private data class SessionsResponse(val sessions: List<SessionSummary>)

@Serializable
private data class ProjectsResponse(val projects: List<Project>)

@Serializable
private data class CreatedResponse(val id: Int, val kitaSession: String)

const val maxUploadBytes = 50L * 1024 * 1024

class CodeApi(private val api: Api) {
    private val base = "/api/apps/code"

    suspend fun sessions(): List<SessionSummary> = api.get<SessionsResponse>("$base/sessions").sessions
    suspend fun projects(): List<Project> = api.get<ProjectsResponse>("$base/projects").projects
    suspend fun search(query: String): SearchResults = api.get("$base/search?q=${encode(query)}")
    suspend fun usage(): CodeUsage? = api.getJson("$base/usage").jsonObject["usage"]?.takeIf { it !is JsonNull }?.let { json.decodeFromJsonElement<CodeUsage>(it) }

    suspend fun createProject(name: String, repository: String, create: Boolean, connect: String? = null): Project {
        val body = buildJsonObject {
            put("name", name)
            put("repository", repository)
            put("create", create)
        }
        val path = if (connect != null) "$base/projects/${encode(connect)}/repository" else "$base/projects"
        return json.decodeFromJsonElement(api.postJson(path, body).jsonObject["project"]!!)
    }

    // 新对话时 sessionId 为 null；返回 session 的编号和 thread
    suspend fun send(sessionId: Int?, project: String, text: String, attachments: List<Upload>, mode: SendMode, choice: Choice): Pair<Int, String> {
        val body = buildJsonObject {
            put("project", project)
            put("text", text)
            putJsonArray("attachments") { attachments.forEach { addJsonObject { put("file", it.file); put("name", it.name) } } }
            if (mode == SendMode.Interrupt) put("interrupt", true)
            if (mode == SendMode.Queue) put("queue", true)
            put("agent", choice.agent)
            choice.model?.let { put("model", it) }
            choice.effort?.let { put("effort", it) }
        }
        val path = if (sessionId == null) "$base/sessions" else "$base/sessions/$sessionId/messages"
        val result = try {
            api.postJson(path, body).jsonObject
        } catch (error: ApiException) {
            throw if (error.status == 503 && error.message == "unavailable") ApiException(503, "消息没能交给 agent，稍后再试") else error
        }
        return result["id"]!!.jsonPrimitive.content.toInt() to result["kitaSession"]!!.jsonPrimitive.content
    }

    suspend fun upload(resolver: ContentResolver, uri: Uri): Upload {
        val (name, size) = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) (cursor.getString(0) ?: "file") to cursor.getLong(1) else null
        } ?: ("file" to -1L)
        if (size > maxUploadBytes) throw ApiException(413, "$name 太大，附件最大 ${maxUploadBytes / 1024 / 1024} MB")
        val body = object : RequestBody() {
            override fun contentType(): MediaType = octetType
            override fun contentLength(): Long = size
            override fun writeTo(sink: BufferedSink) {
                resolver.openInputStream(uri)!!.source().use { sink.writeAll(it) }
            }
        }
        val result = try {
            api.upload("$base/uploads", body, mapOf("X-File-Name" to encode(name)))
        } catch (error: ApiException) {
            throw ApiException(error.status, "上传 $name 失败（${if (error.status == 413) "文件太大" else error.status}）")
        }
        return Upload(result.jsonObject["file"]!!.jsonPrimitive.content, name)
    }

    suspend fun withdraw(sessionId: Int, item: String): String? = runCatching {
        api.postJson("$base/sessions/$sessionId/queue/${encode(item)}/withdraw").jsonObject["text"]?.jsonPrimitive?.content
    }.getOrNull()

    suspend fun sendQueued(sessionId: Int, item: String) {
        api.postJson("$base/sessions/$sessionId/queue/${encode(item)}/send")
    }

    suspend fun stop(sessionId: Int) {
        api.postJson("$base/sessions/$sessionId/stop")
    }

    suspend fun edit(sessionId: Int, title: String? = null, pinned: Boolean? = null, archived: Boolean? = null) {
        api.postJson("$base/sessions/$sessionId/edit", buildJsonObject {
            title?.let { put("title", it) }
            pinned?.let { put("pinned", it) }
            archived?.let { put("archived", it) }
        })
    }

    suspend fun markRead(sessionId: Int) {
        runCatching { api.postJson("$base/sessions/$sessionId/read") }
    }

    // ---- agent 服务 ----

    suspend fun status(): AgentStatus = api.get("/api/kita/status")

    suspend fun accounts(): List<AgentAccount> = json.decodeFromJsonElement(api.getJson("/api/kita/accounts").jsonObject["accounts"]!!)

    suspend fun catalogs(): List<AgentCatalog> = json.decodeFromJsonElement(api.getJson("/api/kita/agents").jsonObject["agents"]!!)

    fun fileUrl(thread: String, file: String, name: String? = null): String =
        api.url("/api/kita/sessions/${encode(thread)}/files/${encode(file)}").newBuilder().apply { name?.let { addQueryParameter("name", it) } }.build().toString()

    // thread 的推送：from() 是已收到的条数，断线重连时接着补发
    fun threadStream(thread: String, from: () -> Int): Flow<StreamSignal> =
        api.eventStream { api.url("/api/kita/sessions/${encode(thread)}/stream?from=${from()}").toString() }
}

// thread 的内容：条目随推送追加，临时内容随推送更新；在主线程上修改，界面直接读取
class ThreadState {
    val items = mutableStateListOf<Entry>()
    var live by mutableStateOf<Live?>(null)
        private set
    var loaded by mutableStateOf(false)
        private set

    fun apply(signal: StreamSignal) {
        if (signal == StreamSignal.Open) loaded = true
        if (signal !is StreamSignal.Message) return
        val event = runCatching { json.parseToJsonElement(signal.message.data).jsonObject }.getOrNull() ?: return
        when (event["type"]?.jsonPrimitive?.content) {
            "event" -> {
                val record = event["event"]!!.jsonObject
                val seq = record["seq"]!!.jsonPrimitive.content.toInt()
                if (seq != items.size + 1) return
                val entry = parseEntry(record["data"]!!)
                items.add(entry)
                live = live?.let { applyEntry(it, entry) }
            }
            "live" -> live = event["live"]?.takeIf { it !is JsonNull }?.let(::parseLive)
            else -> live = live?.let { applyLiveEvent(it, event) }
        }
    }
}

private fun parseLive(element: JsonElement): Live = runCatching { json.decodeFromJsonElement(Live.serializer(), element) }.getOrElse {
    val obj = element.jsonObject
    Live(thinking = obj["thinking"]?.jsonPrimitive?.content ?: "", text = obj["text"]?.jsonPrimitive?.content ?: "")
}

// 记成条目的思考和文字取代对应的临时内容
private fun applyEntry(live: Live, entry: Entry): Live = when {
    entry.parent != null -> live
    entry is Entry.Text -> live.copy(text = "", files = emptyMap())
    entry is Entry.Thinking -> live.copy(thinking = "")
    else -> live
}

private fun applyLiveEvent(live: Live, event: JsonObject): Live {
    val text = { event["text"]?.jsonPrimitive?.content ?: "" }
    return when (event["type"]?.jsonPrimitive?.content) {
        "thinking" -> live.copy(thinking = live.thinking + text())
        "text" -> live.copy(text = live.text + text())
        "file" -> live.copy(files = live.files + (event["path"]!!.jsonPrimitive.content to event["name"]!!.jsonPrimitive.content))
        "status" -> live.copy(status = event["status"]?.takeIf { it !is JsonNull }?.let { runCatching { json.decodeFromJsonElement(Status.serializer(), it) }.getOrNull() })
        "task" -> {
            val callId = event["callId"]!!.jsonPrimitive.content
            val progress = event["progress"]?.takeIf { it !is JsonNull }?.let { json.decodeFromJsonElement(TaskProgress.serializer(), it) }
            live.copy(tasks = if (progress == null) live.tasks - callId else live.tasks + (callId to progress))
        }
        else -> live
    }
}

fun encode(value: String): String = URLEncoder.encode(value, "UTF-8").replace("+", "%20")

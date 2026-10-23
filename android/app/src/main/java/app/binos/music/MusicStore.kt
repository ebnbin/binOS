package app.binos.music

import app.binos.app
import app.binos.code.encode
import app.binos.net.json
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.put
import java.util.UUID

// 和 server/src/apps/music/types.ts 对应

@Serializable
data class TrackRef(val provider: String, val id: String)

@Serializable
data class Album(val id: String? = null, val title: String)

@Serializable
data class Track(
    val ref: TrackRef,
    val title: String,
    val artists: List<String> = emptyList(),
    val album: Album? = null,
    val artworkUrl: String? = null,
    val durationMs: Long? = null,
    val externalUrl: String,
) {
    val key get() = "${ref.provider}:${ref.id}"
    val artistText get() = artists.joinToString(" / ").ifEmpty { "未知艺人" }
}

@Serializable
data class CatalogPage(val tracks: List<Track> = emptyList(), val nextPage: String? = null, val warning: String? = null)

@Serializable
data class Capability(val state: String, val reason: String? = null)

@Serializable
data class ReferenceRule(val pattern: String, val capability: String)

@Serializable
data class ProviderInput(val references: List<ReferenceRule> = emptyList())

@Serializable
data class ProviderInfo(
    val id: String,
    val name: String,
    val description: String = "",
    val input: ProviderInput = ProviderInput(),
    val capabilities: Map<String, Capability> = emptyMap(),
) {
    fun available(operation: String) = capabilities[operation]?.state == "available"

    // 输入的是链接时导入，否则搜索
    fun operationFor(query: String): String =
        input.references.firstOrNull { Regex(it.pattern, RegexOption.IGNORE_CASE).containsMatchIn(query) }?.capability ?: "search"
}

@Serializable
private data class Providers(val providers: List<ProviderInfo>)

@Serializable
data class QueueSnapshot(val revision: Int = 0, val tracks: List<Track> = emptyList())

@Serializable
data class Lyrics(val text: String, val attribution: String? = null)

private const val base = "/api/apps/music"

// 音乐的共享数据：所有设备共用的播放队列和音乐来源，随 music 通知重新读取
object MusicStore {
    private val _queue = MutableStateFlow<List<Track>?>(null)
    val queue: StateFlow<List<Track>?> = _queue.asStateFlow()
    private val _providers = MutableStateFlow<List<ProviderInfo>>(emptyList())
    val providers: StateFlow<List<ProviderInfo>> = _providers.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    init {
        app.scope.launch { app.events.of("music").collect { refresh() } }
        refresh()
    }

    fun refresh() {
        app.scope.launch {
            runCatching { app.api.get<QueueSnapshot>("$base/queue") }.onSuccess { _queue.value = it.tracks }.onFailure { _error.value = it.message }
            runCatching { app.api.get<Providers>("$base/providers") }.onSuccess { _providers.value = it.providers }
        }
    }

    private fun mutate(operation: JsonElement) {
        app.scope.launch {
            runCatching {
                app.api.post<QueueSnapshot>("$base/queue", buildJsonObject {
                    put("id", UUID.randomUUID().toString())
                    put("operation", operation)
                })
            }.onSuccess { _queue.value = it.tracks; _error.value = null }.onFailure { _error.value = it.message }
        }
    }

    fun add(tracks: List<Track>) = mutate(buildJsonObject {
        put("type", "add")
        put("tracks", json.encodeToJsonElement(tracks))
    })

    fun remove(track: Track) = mutate(buildJsonObject {
        put("type", "remove")
        put("ref", json.encodeToJsonElement(track.ref))
    })

    fun clear() = mutate(buildJsonObject { put("type", "clear") })

    suspend fun catalog(provider: String, operation: String, query: String, page: String? = null): CatalogPage =
        app.api.get("$base/providers/${encode(provider)}/$operation?q=${encode(query)}" + (page?.let { "&page=${encode(it)}" } ?: ""))

    suspend fun lyrics(track: Track): Lyrics = app.api.get("$base/providers/${encode(track.ref.provider)}/lyrics?q=${encode(track.ref.id)}")

    // 后端代理的纯音频流；两个来源的 id 都是 YouTube 的视频 id，官方来源只能嵌入播放，原生播放时同样走这条音频流
    fun streamUrl(track: Track): String = app.api.url("$base/providers/youtube-music/stream?id=${encode(track.ref.id)}").toString()
}

package app.binos.code

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Article
import androidx.compose.material.icons.automirrored.outlined.ListAlt
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Build
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Image
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.NoteAdd
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.SmartToy
import androidx.compose.material.icons.outlined.Terminal
import androidx.compose.material.icons.outlined.TravelExplore
import androidx.compose.material.icons.outlined.Web
import androidx.compose.material.icons.outlined.Widgets
import androidx.compose.ui.graphics.vector.ImageVector
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.time.Instant

// 和 web/src/services/kita/session 的 Transcript.tsx、tools.ts、transcript-index.ts 对应：把条目整理成显示的块

data class IndexedEntry(val item: Entry, val index: Int)

// live：这一轮还在回答，没有结果的调用还在运行
data class CallState(val call: Entry.ToolCall, val result: Entry.ToolResult?, val live: Boolean) {
    val status: String get() = result?.status ?: if (live) "running" else "stopped"

    fun durationMs(now: Long): Long? = when {
        result != null -> parseTime(result.time) - parseTime(call.time)
        live -> (now - parseTime(call.time)).coerceAtLeast(0)
        else -> null
    }
}

// 工具结果和子 agent 的条目按所属调用关联；调用 id 只在当前轮内匹配
class TranscriptIndex(items: List<Entry>) {
    val results = HashMap<Entry.ToolCall, Entry.ToolResult>()
    val children = HashMap<Entry.ToolCall, MutableList<IndexedEntry>>()
    val main = ArrayList<IndexedEntry>()

    init {
        var turn = ArrayList<IndexedEntry>()
        fun flush() {
            val calls = turn.mapNotNull { it.item as? Entry.ToolCall }.associateBy { it.id }
            for (entry in turn) {
                val item = entry.item
                if (item is Entry.ToolResult) calls[item.callId]?.let { results[it] = item }
                val parent = item.parent?.let { calls[it] }
                if (parent != null) children.getOrPut(parent) { ArrayList() }.add(entry) else main.add(entry)
            }
            turn = ArrayList()
        }
        items.forEachIndexed { index, item ->
            if (item is Entry.Input && item.mode == "start") flush()
            turn.add(IndexedEntry(item, index))
        }
        flush()
    }
}

sealed interface Step {
    val key: String
    val time: String

    data class Thinking(override val key: String, override val time: String, val text: String, val durationMs: Long?) : Step
    data class Tool(override val key: String, override val time: String, val state: CallState) : Step
    data class Subagent(override val key: String, override val time: String, val state: CallState) : Step
}

sealed interface Block {
    val key: String

    data class Turn(override val key: String) : Block
    data class Time(override val key: String, val time: String) : Block
    data class Input(override val key: String, val index: Int, val text: String, val time: String) : Block
    data class Attachments(override val key: String, val attachments: List<Attachment>) : Block
    data class Text(override val key: String, val text: String, val files: Map<String, String>) : Block
    data class Steps(override val key: String, val steps: MutableList<Step>) : Block
    data class Compact(override val key: String, val item: Entry.Compact) : Block
    data class Interrupted(override val key: String) : Block
    data class TurnEnd(override val key: String, val item: Entry.TurnEnd, val reply: String, val edits: List<CallState>) : Block
}

// 一轮开始时离上一条超过这么久，先显示一条时间
private const val dividerGapMs = 30 * 60 * 1000L

fun buildBlocks(entries: List<IndexedEntry>, index: TranscriptIndex, running: Boolean): List<Block> {
    val blocks = ArrayList<Block>()
    fun addStep(step: Step) {
        val last = blocks.lastOrNull()
        if (last is Block.Steps) last.steps.add(step) else blocks.add(Block.Steps(step.key, mutableListOf(step)))
    }
    var replies = ArrayList<String>()
    var edits = ArrayList<CallState>()
    var lastTime: Long? = null
    for ((item, position) in entries) {
        val key = position.toString()
        val previous = lastTime
        val time = parseTime(item.time)
        lastTime = time
        when (item) {
            is Entry.Input -> {
                if (item.mode == "start") {
                    replies = ArrayList()
                    edits = ArrayList()
                    blocks.add(Block.Turn("$key-turn"))
                    if (previous == null || time - previous > dividerGapMs || !sameDay(time, previous)) {
                        blocks.add(Block.Time("$key-time", item.time))
                    }
                }
                if (item.mode == "interrupt") blocks.add(Block.Interrupted("$key-interrupted"))
                if (item.attachments.isNotEmpty()) blocks.add(Block.Attachments("$key-attachments", item.attachments))
                if (item.text.isNotBlank()) blocks.add(Block.Input(key, position, item.text, item.time))
            }
            is Entry.Thinking -> addStep(Step.Thinking(key, item.time, item.text, item.durationMs))
            is Entry.Text -> if (item.text.isNotBlank()) {
                replies.add(item.text)
                blocks.add(Block.Text(key, item.text, item.files))
            }
            is Entry.ToolCall -> {
                val state = CallState(item, index.results[item], running)
                edits.addAll(editCalls(state, index))
                addStep(if (item.tool is ToolDetail.Subagent) Step.Subagent(key, item.time, state) else Step.Tool(key, item.time, state))
            }
            is Entry.Compact -> blocks.add(Block.Compact(key, item))
            is Entry.TurnEnd -> blocks.add(Block.TurnEnd(key, item, replies.joinToString("\n\n"), edits))
            else -> Unit
        }
    }
    return blocks
}

// 这次调用改了文件就是它自己；是子 agent 时，是子 agent 里改文件的调用
private fun editCalls(state: CallState, index: TranscriptIndex): List<CallState> {
    if (state.call.tool is ToolDetail.Edit) return listOf(state)
    return index.children[state.call].orEmpty().flatMap { (item) ->
        if (item is Entry.ToolCall) editCalls(CallState(item, index.results[item], state.live), index) else emptyList()
    }
}

enum class ToolCategory(val text: (Int) -> String) {
    Command({ "运行 $it 条命令" }),
    Read({ "查看 $it 个文件" }),
    Edit({ "修改 $it 个文件" }),
    Search({ "搜索 $it 次" }),
    Web({ "打开 $it 个网页" }),
    Browser({ "操作浏览器 $it 次" }),
    Subagent({ "启动 $it 个子 agent" }),
    Other({ "调用 $it 次工具" }),
}

data class ToolLabel(val icon: ImageVector, val verb: String, val category: ToolCategory, val detail: String? = null)

private val browserVerbs = mapOf(
    "navigate" to "浏览器打开",
    "computer" to "操作浏览器",
    "browser_batch" to "操作浏览器",
    "javascript_tool" to "在浏览器里执行脚本",
    "read_page" to "读取页面",
    "get_page_text" to "读取页面",
    "find" to "在页面里查找",
    "form_input" to "填写表单",
    "read_console_messages" to "查看控制台",
    "read_network_requests" to "查看网络请求",
    "tabs_context_mcp" to "查看标签页",
    "tabs_create_mcp" to "新建标签页",
    "tabs_close_mcp" to "关闭标签页",
)

// 原始参数里的第一个字符串
private fun firstText(input: kotlinx.serialization.json.JsonElement?): String? =
    (input as? JsonObject)?.values?.firstNotNullOfOrNull { (it as? JsonPrimitive)?.takeIf { value -> value.isString }?.content }

fun toolLabel(call: Entry.ToolCall): ToolLabel = when (val tool = call.tool) {
    is ToolDetail.Command -> ToolLabel(Icons.Outlined.Terminal, "运行", ToolCategory.Command, tool.command)
    is ToolDetail.Read -> ToolLabel(Icons.AutoMirrored.Outlined.Article, "查看", ToolCategory.Read, tool.path)
    is ToolDetail.Edit -> if (tool.change is FileChange.Write) ToolLabel(Icons.Outlined.NoteAdd, "写入", ToolCategory.Edit, tool.path)
    else ToolLabel(Icons.Outlined.Edit, "修改", ToolCategory.Edit, tool.path)
    is ToolDetail.Search -> ToolLabel(Icons.Outlined.Search, if (tool.target == "files") "查找文件" else "搜索", ToolCategory.Search, tool.pattern)
    is ToolDetail.WebSearch -> ToolLabel(Icons.Outlined.TravelExplore, "搜索网页", ToolCategory.Search, tool.query)
    is ToolDetail.WebFetch -> ToolLabel(Icons.Outlined.Language, "打开网页", ToolCategory.Web, tool.url)
    is ToolDetail.ImageView -> ToolLabel(Icons.Outlined.Image, "查看图片", ToolCategory.Read, tool.path)
    is ToolDetail.Browser -> ToolLabel(Icons.Outlined.Web, browserVerbs[tool.action] ?: "浏览器 ${tool.action}", ToolCategory.Browser, tool.target)
    is ToolDetail.Mcp -> ToolLabel(Icons.Outlined.Build, "${tool.server} ${tool.tool}", ToolCategory.Other, firstText(call.input))
    is ToolDetail.Subagent -> ToolLabel(Icons.Outlined.SmartToy, "子 agent", ToolCategory.Subagent, tool.description)
    is ToolDetail.ToolSearch -> ToolLabel(Icons.Outlined.Widgets, "加载工具", ToolCategory.Other, tool.query)
    is ToolDetail.Skill -> ToolLabel(Icons.Outlined.AutoAwesome, "使用技能", ToolCategory.Other, tool.name)
    ToolDetail.Todo -> ToolLabel(Icons.AutoMirrored.Outlined.ListAlt, "更新待办", ToolCategory.Other)
    ToolDetail.Other -> ToolLabel(Icons.Outlined.Build, call.name.removePrefix("mcp__").replace("__", " "), ToolCategory.Other, firstText(call.input))
}

// 一组步骤的摘要，比如「运行 3 条命令，查看 2 个文件」；修改的文件按路径去重
fun summarize(steps: List<Step>): String {
    val counts = HashMap<ToolCategory, MutableSet<String>>()
    for (step in steps) {
        val call = when (step) {
            is Step.Tool -> step.state.call
            is Step.Subagent -> step.state.call
            is Step.Thinking -> continue
        }
        val id = (call.tool as? ToolDetail.Edit)?.path ?: call.id
        counts.getOrPut(toolLabel(call).category) { HashSet() }.add(id)
    }
    val parts = ToolCategory.entries.mapNotNull { category -> counts[category]?.size?.let { category.text(it) } }
    return if (parts.isEmpty()) "思考 ${steps.size} 次" else parts.joinToString("，")
}

// ---- 改文件 ----

enum class DiffKind { Same, Added, Removed, Hunk }

data class DiffLine(val kind: DiffKind, val text: String)

// 按行比较前后两段文字：最长公共子序列，太长时退化成全删全增
fun diffLines(before: String, after: String): List<DiffLine> {
    val a = before.removeSuffix("\n").split('\n')
    val b = after.removeSuffix("\n").split('\n')
    if (a.size.toLong() * b.size > 4_000_000) {
        return a.map { DiffLine(DiffKind.Removed, it) } + b.map { DiffLine(DiffKind.Added, it) }
    }
    val lcs = Array(a.size + 1) { IntArray(b.size + 1) }
    for (i in a.indices.reversed()) for (j in b.indices.reversed()) {
        lcs[i][j] = if (a[i] == b[j]) lcs[i + 1][j + 1] + 1 else maxOf(lcs[i + 1][j], lcs[i][j + 1])
    }
    val lines = ArrayList<DiffLine>()
    var i = 0
    var j = 0
    while (i < a.size && j < b.size) {
        when {
            a[i] == b[j] -> { lines.add(DiffLine(DiffKind.Same, a[i])); i++; j++ }
            lcs[i + 1][j] >= lcs[i][j + 1] -> lines.add(DiffLine(DiffKind.Removed, a[i++]))
            else -> lines.add(DiffLine(DiffKind.Added, b[j++]))
        }
    }
    while (i < a.size) lines.add(DiffLine(DiffKind.Removed, a[i++]))
    while (j < b.size) lines.add(DiffLine(DiffKind.Added, b[j++]))
    return lines
}

// 统一格式的 diff，去掉文件头
fun patchLines(diff: String): List<DiffLine> = diff.removeSuffix("\n").split('\n')
    .filter { !it.startsWith("+++") && !it.startsWith("---") }
    .map { line ->
        when (line.firstOrNull()) {
            '+' -> DiffLine(DiffKind.Added, line.drop(1))
            '-' -> DiffLine(DiffKind.Removed, line.drop(1))
            '@' -> DiffLine(DiffKind.Hunk, line)
            ' ' -> DiffLine(DiffKind.Same, line.drop(1))
            else -> DiffLine(DiffKind.Same, line)
        }
    }

data class LineChanges(val added: Int, val removed: Int)

fun lineChanges(call: Entry.ToolCall): LineChanges? {
    val change = (call.tool as? ToolDetail.Edit)?.change ?: return null
    return when (change) {
        is FileChange.Write -> LineChanges(change.content.removeSuffix("\n").split('\n').size, 0)
        is FileChange.Replace -> diffLines(change.before, change.after).let { lines ->
            LineChanges(lines.count { it.kind == DiffKind.Added }, lines.count { it.kind == DiffKind.Removed })
        }
        is FileChange.Diff -> {
            val lines = change.diff.removeSuffix("\n").split('\n')
            if (change.op != "update") {
                val count = if (change.diff.isEmpty()) 0 else lines.size
                if (change.op == "add") LineChanges(count, 0) else LineChanges(0, count)
            } else {
                val body = lines.filter { !it.startsWith("+++") && !it.startsWith("---") }
                LineChanges(body.count { it.startsWith("+") }, body.count { it.startsWith("-") })
            }
        }
    }
}

// 一轮里改过的一个文件；op 是新建或删除了它
data class ChangedFile(val path: String, var added: Int = 0, var removed: Int = 0, var op: String? = null, val calls: MutableList<CallState> = mutableListOf())

// 成功的修改按文件合并，顺序是第一次改它的顺序
fun fileChanges(states: List<CallState>): List<ChangedFile> {
    val files = LinkedHashMap<String, ChangedFile>()
    for (state in states) {
        val tool = state.call.tool as? ToolDetail.Edit ?: continue
        if (state.result?.status != "done") continue
        val file = files.getOrPut(tool.path) { ChangedFile(tool.path) }
        lineChanges(state.call)?.let {
            file.added += it.added
            file.removed += it.removed
        }
        (tool.change as? FileChange.Diff)?.takeIf { it.op != "update" }?.let { file.op = it.op }
        file.calls.add(state)
    }
    return files.values.toList()
}

fun parseTime(time: String): Long = runCatching { Instant.parse(time).toEpochMilli() }.getOrDefault(0L)

fun sameDay(a: Long, b: Long): Boolean {
    val zone = java.time.ZoneId.systemDefault()
    return Instant.ofEpochMilli(a).atZone(zone).toLocalDate() == Instant.ofEpochMilli(b).atZone(zone).toLocalDate()
}

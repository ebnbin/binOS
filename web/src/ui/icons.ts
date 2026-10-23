import type { LucideIcon } from 'lucide-react'
import {
  AppWindow,
  ArchiveRestore,
  Bot,
  Brain,
  Cpu,
  FileDiff,
  Folder,
  FolderPlus,
  Gauge,
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  Hammer,
  HardDrive,
  ImageOff,
  ListMusic,
  ListPlus,
  ListTodo,
  MemoryStick,
  Music,
  Network,
  PackageSearch,
  Paperclip,
  PinOff,
  PlugZap,
  Repeat1,
  SquareTerminal,
  Wrench,
} from 'lucide-react'
import { createElement } from 'react'
import type { ComponentType, SVGAttributes } from 'react'

// binOS 的图标都从这里取：用 Radix Icons（15×15 网格），它没有的概念用 Lucide 补，
// 补的图标按 Radix Icons 的默认尺寸和线宽（15px 下约 1px）画，两套放在一起粗细一致
type IconProps = Omit<SVGAttributes<SVGElement>, 'children'> & { children?: never; color?: string }
export type Icon = ComponentType<IconProps>

export function fromLucide(Lucide: LucideIcon): Icon {
  const Wrapped = (props: IconProps) => createElement(Lucide, { width: 15, height: 15, strokeWidth: 1.6, ...props })
  Wrapped.displayName = Lucide.displayName
  return Wrapped
}

export {
  ActivityLogIcon,
  ArchiveIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowTopRightIcon,
  ArrowUpIcon,
  CalendarIcon,
  CameraIcon,
  ChatBubbleIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClipboardIcon,
  ClockIcon,
  CodeIcon,
  CopyIcon,
  CountdownTimerIcon,
  Cross2Icon,
  CrossCircledIcon,
  DashboardIcon,
  DesktopIcon,
  DiscIcon,
  DotsHorizontalIcon,
  DownloadIcon,
  DragHandleDots2Icon,
  DragHandleHorizontalIcon,
  DrawingPinFilledIcon,
  DrawingPinIcon,
  EnterFullScreenIcon,
  EnterIcon,
  ExclamationTriangleIcon,
  ExternalLinkIcon,
  FileIcon,
  FilePlusIcon,
  FileTextIcon,
  GearIcon,
  GlobeIcon,
  HomeIcon,
  ImageIcon,
  InfoCircledIcon,
  KeyboardIcon,
  LightningBoltIcon,
  ListBulletIcon,
  LoopIcon,
  MagicWandIcon,
  MagnifyingGlassIcon,
  MinusIcon,
  MixerHorizontalIcon,
  MobileIcon,
  PauseIcon,
  Pencil1Icon,
  Pencil2Icon,
  PersonIcon,
  PlayIcon,
  PlusIcon,
  ReloadIcon,
  ScissorsIcon,
  SpeakerLoudIcon,
  SpeakerOffIcon,
  StopIcon,
  TrackNextIcon,
  TrackPreviousIcon,
  TrashIcon,
  UploadIcon,
  ViewGridIcon,
} from '@radix-ui/react-icons'

export const AppWindowIcon = fromLucide(AppWindow)
export const ArchiveRestoreIcon = fromLucide(ArchiveRestore)
export const BotIcon = fromLucide(Bot)
export const BrainIcon = fromLucide(Brain)
export const CpuIcon = fromLucide(Cpu)
export const FileDiffIcon = fromLucide(FileDiff)
export const FolderIcon = fromLucide(Folder)
export const FolderPlusIcon = fromLucide(FolderPlus)
export const GaugeIcon = fromLucide(Gauge)
export const GitMergeIcon = fromLucide(GitMerge)
export const GitPullRequestIcon = fromLucide(GitPullRequest)
export const GitPullRequestClosedIcon = fromLucide(GitPullRequestClosed)
export const HammerIcon = fromLucide(Hammer)
export const HardDriveIcon = fromLucide(HardDrive)
export const ImageOffIcon = fromLucide(ImageOff)
export const ListMusicIcon = fromLucide(ListMusic)
export const ListPlusIcon = fromLucide(ListPlus)
export const ListTodoIcon = fromLucide(ListTodo)
export const MemoryIcon = fromLucide(MemoryStick)
export const MusicIcon = fromLucide(Music)
export const NetworkIcon = fromLucide(Network)
export const PackageSearchIcon = fromLucide(PackageSearch)
export const PaperclipIcon = fromLucide(Paperclip)
export const PinOffIcon = fromLucide(PinOff)
export const PlugZapIcon = fromLucide(PlugZap)
export const RepeatOneIcon = fromLucide(Repeat1)
export const TerminalIcon = fromLucide(SquareTerminal)
export const WrenchIcon = fromLucide(Wrench)

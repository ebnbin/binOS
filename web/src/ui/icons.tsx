import type { ComponentType, CSSProperties } from 'react'
import './icons.css'
import ActivityIcon from '@react-spectrum/s2/icons/AudioWave'
import AppWindowIcon from '@react-spectrum/s2/icons/App'
import ArchiveIcon from '@react-spectrum/s2/icons/Archive'
import ArchiveRestoreIcon from '@react-spectrum/s2/icons/Revert'
import ArrowDownIcon from '@react-spectrum/s2/icons/SortDown'
import ArrowLeftIcon from '@react-spectrum/s2/icons/ChevronLeft'
import ArrowRightIcon from '@react-spectrum/s2/icons/ChevronRight'
import ArrowUpIcon from '@react-spectrum/s2/icons/ChevronUp'
import ArrowUpRightIcon from '@react-spectrum/s2/icons/OpenIn'
import BookOpenIcon from '@react-spectrum/s2/icons/Tutorials'
import BotIcon from '@react-spectrum/s2/icons/AIMark'
import BriefcaseIcon from '@react-spectrum/s2/icons/Briefcase'
import CalculatorIcon from '@react-spectrum/s2/icons/Table'
import CalendarDaysIcon from '@react-spectrum/s2/icons/Calendar'
import CameraIcon from '@react-spectrum/s2/icons/Camera'
import ChartLineIcon from '@react-spectrum/s2/icons/ChartTrend'
import CheckIcon from '@react-spectrum/s2/icons/Checkmark'
import ChevronDownIcon from '@react-spectrum/s2/icons/ChevronDown'
import ChevronLeftIcon from '@react-spectrum/s2/icons/ChevronLeft'
import ChevronRightIcon from '@react-spectrum/s2/icons/ChevronRight'
import CircleAlertIcon from '@react-spectrum/s2/icons/AlertTriangle'
import CircleStopIcon from '@react-spectrum/s2/icons/StopProcessing'
import ClockIcon from '@react-spectrum/s2/icons/Clock'
import CloudIcon from '@react-spectrum/s2/icons/Cloud'
import CodeIcon from '@react-spectrum/s2/icons/Code'
import CodeXmlIcon from '@react-spectrum/s2/icons/Code'
import CopyIcon from '@react-spectrum/s2/icons/Copy'
import CpuIcon from '@react-spectrum/s2/icons/Data'
import DatabaseIcon from '@react-spectrum/s2/icons/Data'
import Disc3Icon from '@react-spectrum/s2/icons/MusicNote'
import DownloadIcon from '@react-spectrum/s2/icons/Download'
import DumbbellIcon from '@react-spectrum/s2/icons/Interaction'
import ExpandIcon from '@react-spectrum/s2/icons/FullScreen'
import ExternalLinkIcon from '@react-spectrum/s2/icons/OpenIn'
import FileIcon from '@react-spectrum/s2/icons/File'
import FileDiffIcon from '@react-spectrum/s2/icons/Compare'
import FilePenIcon from '@react-spectrum/s2/icons/Edit'
import FilePlusIcon from '@react-spectrum/s2/icons/FileAdd'
import FileTextIcon from '@react-spectrum/s2/icons/FileText'
import FilmIcon from '@react-spectrum/s2/icons/Filmstrip'
import FolderIcon from '@react-spectrum/s2/icons/Folder'
import Gamepad2Icon from '@react-spectrum/s2/icons/Interaction'
import GaugeIcon from '@react-spectrum/s2/icons/SpeedFast'
import GitMergeIcon from '@react-spectrum/s2/icons/Group'
import GitPullRequestIcon from '@react-spectrum/s2/icons/Share'
import GitPullRequestClosedIcon from '@react-spectrum/s2/icons/UnLink'
import GlobeIcon from '@react-spectrum/s2/icons/GlobeGrid'
import GraduationCapIcon from '@react-spectrum/s2/icons/Education'
import HammerIcon from '@react-spectrum/s2/icons/Tools'
import HardDriveIcon from '@react-spectrum/s2/icons/SaveFloppy'
import HeartIcon from '@react-spectrum/s2/icons/Heart'
import HomeIcon from '@react-spectrum/s2/icons/Home'
import HourglassIcon from '@react-spectrum/s2/icons/ClockPending'
import HouseIcon from '@react-spectrum/s2/icons/Home'
import ImageIcon from '@react-spectrum/s2/icons/Image'
import ImageOffIcon from '@react-spectrum/s2/icons/MediaOffline'
import InfoIcon from '@react-spectrum/s2/icons/InfoCircle'
import LayoutGridIcon from '@react-spectrum/s2/icons/ViewGrid'
import LeafIcon from '@react-spectrum/s2/icons/Discover'
import ListIcon from '@react-spectrum/s2/icons/ViewList'
import ListMusicIcon from '@react-spectrum/s2/icons/ListBulleted'
import ListPlusIcon from '@react-spectrum/s2/icons/AddContent'
import ListTodoIcon from '@react-spectrum/s2/icons/ListMultiSelect'
import LoaderCircleIcon from '@react-spectrum/s2/icons/Refresh'
import LockIcon from '@react-spectrum/s2/icons/Lock'
import MailIcon from '@react-spectrum/s2/icons/Email'
import MapIcon from '@react-spectrum/s2/icons/Location'
import MemoryStickIcon from '@react-spectrum/s2/icons/Data'
import MessageCircleIcon from '@react-spectrum/s2/icons/Chat'
import MessageSquareIcon from '@react-spectrum/s2/icons/Comment'
import MonitorIcon from '@react-spectrum/s2/icons/DeviceDesktop'
import MoreHorizontalIcon from '@react-spectrum/s2/icons/More'
import MusicIcon from '@react-spectrum/s2/icons/MusicNote'
import Music2Icon from '@react-spectrum/s2/icons/MusicNote'
import NetworkIcon from '@react-spectrum/s2/icons/SocialNetwork'
import NewspaperIcon from '@react-spectrum/s2/icons/WebPage'
import PackageSearchIcon from '@react-spectrum/s2/icons/FolderSearch'
import PaperclipIcon from '@react-spectrum/s2/icons/Attach'
import PauseIcon from '@react-spectrum/s2/icons/Pause'
import PencilIcon from '@react-spectrum/s2/icons/Edit'
import PinIcon from '@react-spectrum/s2/icons/PinOn'
import PinOffIcon from '@react-spectrum/s2/icons/PinOff'
import PlaneIcon from '@react-spectrum/s2/icons/Send'
import PlayIcon from '@react-spectrum/s2/icons/Play'
import PlugZapIcon from '@react-spectrum/s2/icons/Plugin'
import PlusIcon from '@react-spectrum/s2/icons/Add'
import PuzzleIcon from '@react-spectrum/s2/icons/Plugin'
import RefreshCwIcon from '@react-spectrum/s2/icons/Refresh'
import RepeatIcon from '@react-spectrum/s2/icons/Refresh'
import Repeat1Icon from '@react-spectrum/s2/icons/Redo'
import RotateCwIcon from '@react-spectrum/s2/icons/RotateCW'
import SearchIcon from '@react-spectrum/s2/icons/Search'
import Settings2Icon from '@react-spectrum/s2/icons/Settings'
import ShoppingCartIcon from '@react-spectrum/s2/icons/ShoppingCart'
import SkipBackIcon from '@react-spectrum/s2/icons/StepBackward'
import SkipForwardIcon from '@react-spectrum/s2/icons/StepForward'
import SmartphoneIcon from '@react-spectrum/s2/icons/DevicePhone'
import SparklesIcon from '@react-spectrum/s2/icons/MagicWand'
import SquarePenIcon from '@react-spectrum/s2/icons/Edit'
import SquareTerminalIcon from '@react-spectrum/s2/icons/Prompt'
import StarIcon from '@react-spectrum/s2/icons/Star'
import SwordsIcon from '@react-spectrum/s2/icons/Tools'
import TerminalIcon from '@react-spectrum/s2/icons/Prompt'
import UploadIcon from '@react-spectrum/s2/icons/Upload'
import UserRoundIcon from '@react-spectrum/s2/icons/User'
import UtensilsIcon from '@react-spectrum/s2/icons/Market'
import Volume2Icon from '@react-spectrum/s2/icons/VolumeTwo'
import VolumeXIcon from '@react-spectrum/s2/icons/VolumeOff'
import WalletIcon from '@react-spectrum/s2/icons/Wallet'
import WrenchIcon from '@react-spectrum/s2/icons/Tools'
import XIcon from '@react-spectrum/s2/icons/Close'
import ZapIcon from '@react-spectrum/s2/icons/RocketQuickActions'

export type IconProps = {
  size?: number | string
  className?: string
  style?: CSSProperties
  strokeWidth?: number
  fill?: string
  'aria-hidden'?: boolean | 'true' | 'false'
}
export type SystemIcon = ComponentType<IconProps>

function icon(Component: ComponentType): SystemIcon {
  return ({ size = 20, className = '', style }: IconProps) => {
    return (
      <span
        aria-hidden="true"
        className={`system-icon ${className}`}
        style={{ width: size, height: size, flex: 'none', ...style }}
      >
        <Component />
      </span>
    )
  }
}
export const Activity = icon(ActivityIcon)
export const AppWindow = icon(AppWindowIcon)
export const Archive = icon(ArchiveIcon)
export const ArchiveRestore = icon(ArchiveRestoreIcon)
export const ArrowDown = icon(ArrowDownIcon)
export const ArrowLeft = icon(ArrowLeftIcon)
export const ArrowRight = icon(ArrowRightIcon)
export const ArrowUp = icon(ArrowUpIcon)
export const ArrowUpRight = icon(ArrowUpRightIcon)
export const BookOpen = icon(BookOpenIcon)
export const Bot = icon(BotIcon)
export const Briefcase = icon(BriefcaseIcon)
export const Calculator = icon(CalculatorIcon)
export const CalendarDays = icon(CalendarDaysIcon)
export const Camera = icon(CameraIcon)
export const ChartLine = icon(ChartLineIcon)
export const Check = icon(CheckIcon)
export const ChevronDown = icon(ChevronDownIcon)
export const ChevronLeft = icon(ChevronLeftIcon)
export const ChevronRight = icon(ChevronRightIcon)
export const CircleAlert = icon(CircleAlertIcon)
export const CircleStop = icon(CircleStopIcon)
export const Clock = icon(ClockIcon)
export const Cloud = icon(CloudIcon)
export const Code = icon(CodeIcon)
export const CodeXml = icon(CodeXmlIcon)
export const Copy = icon(CopyIcon)
export const Cpu = icon(CpuIcon)
export const Database = icon(DatabaseIcon)
export const Disc3 = icon(Disc3Icon)
export const Download = icon(DownloadIcon)
export const Dumbbell = icon(DumbbellIcon)
export const Expand = icon(ExpandIcon)
export const ExternalLink = icon(ExternalLinkIcon)
export const File = icon(FileIcon)
export const FileDiff = icon(FileDiffIcon)
export const FilePen = icon(FilePenIcon)
export const FilePlus = icon(FilePlusIcon)
export const FileText = icon(FileTextIcon)
export const Film = icon(FilmIcon)
export const Folder = icon(FolderIcon)
export const Gamepad2 = icon(Gamepad2Icon)
export const Gauge = icon(GaugeIcon)
export const GitMerge = icon(GitMergeIcon)
export const GitPullRequest = icon(GitPullRequestIcon)
export const GitPullRequestClosed = icon(GitPullRequestClosedIcon)
export const Globe = icon(GlobeIcon)
export const GraduationCap = icon(GraduationCapIcon)
export const Hammer = icon(HammerIcon)
export const HardDrive = icon(HardDriveIcon)
export const Heart = icon(HeartIcon)
export const Home = icon(HomeIcon)
export const Hourglass = icon(HourglassIcon)
export const House = icon(HouseIcon)
export const Image = icon(ImageIcon)
export const ImageOff = icon(ImageOffIcon)
export const Info = icon(InfoIcon)
export const LayoutGrid = icon(LayoutGridIcon)
export const Leaf = icon(LeafIcon)
export const List = icon(ListIcon)
export const ListMusic = icon(ListMusicIcon)
export const ListPlus = icon(ListPlusIcon)
export const ListTodo = icon(ListTodoIcon)
export const LoaderCircle = icon(LoaderCircleIcon)
export const Lock = icon(LockIcon)
export const Mail = icon(MailIcon)
export const Map = icon(MapIcon)
export const MemoryStick = icon(MemoryStickIcon)
export const MessageCircle = icon(MessageCircleIcon)
export const MessageSquare = icon(MessageSquareIcon)
export const Monitor = icon(MonitorIcon)
export const MoreHorizontal = icon(MoreHorizontalIcon)
export const Music = icon(MusicIcon)
export const Music2 = icon(Music2Icon)
export const Network = icon(NetworkIcon)
export const Newspaper = icon(NewspaperIcon)
export const PackageSearch = icon(PackageSearchIcon)
export const Paperclip = icon(PaperclipIcon)
export const Pause = icon(PauseIcon)
export const Pencil = icon(PencilIcon)
export const Pin = icon(PinIcon)
export const PinOff = icon(PinOffIcon)
export const Plane = icon(PlaneIcon)
export const Play = icon(PlayIcon)
export const PlugZap = icon(PlugZapIcon)
export const Plus = icon(PlusIcon)
export const Puzzle = icon(PuzzleIcon)
export const RefreshCw = icon(RefreshCwIcon)
export const Repeat = icon(RepeatIcon)
export const Repeat1 = icon(Repeat1Icon)
export const RotateCw = icon(RotateCwIcon)
export const Search = icon(SearchIcon)
export const Settings2 = icon(Settings2Icon)
export const ShoppingCart = icon(ShoppingCartIcon)
export const SkipBack = icon(SkipBackIcon)
export const SkipForward = icon(SkipForwardIcon)
export const Smartphone = icon(SmartphoneIcon)
export const Sparkles = icon(SparklesIcon)
export const SquarePen = icon(SquarePenIcon)
export const SquareTerminal = icon(SquareTerminalIcon)
export const Star = icon(StarIcon)
export const Swords = icon(SwordsIcon)
export const Terminal = icon(TerminalIcon)
export const Upload = icon(UploadIcon)
export const UserRound = icon(UserRoundIcon)
export const Utensils = icon(UtensilsIcon)
export const Volume2 = icon(Volume2Icon)
export const VolumeX = icon(VolumeXIcon)
export const Wallet = icon(WalletIcon)
export const Wrench = icon(WrenchIcon)
export const X = icon(XIcon)
export const Zap = icon(ZapIcon)

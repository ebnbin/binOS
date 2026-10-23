import type { FluentIcon } from '@fluentui/react-icons/headless'
import { AppsColor } from '@fluentui/react-icons/headless/svg/apps'
import { BeachColor } from '@fluentui/react-icons/headless/svg/beach'
import { BookOpenColor } from '@fluentui/react-icons/headless/svg/book-open'
import { BriefcaseColor } from '@fluentui/react-icons/headless/svg/briefcase'
import { BuildingStoreColor } from '@fluentui/react-icons/headless/svg/building-store'
import { CameraColor } from '@fluentui/react-icons/headless/svg/camera'
import { ChatColor } from '@fluentui/react-icons/headless/svg/chat'
import { CloudColor } from '@fluentui/react-icons/headless/svg/cloud'
import { CodeColor } from '@fluentui/react-icons/headless/svg/code'
import { CodeBlockColor } from '@fluentui/react-icons/headless/svg/code-block'
import { DataTrendingColor } from '@fluentui/react-icons/headless/svg/data-trending'
import { DatabaseColor } from '@fluentui/react-icons/headless/svg/database'
import { FoodColor } from '@fluentui/react-icons/headless/svg/food'
import { GameChatColor } from '@fluentui/react-icons/headless/svg/game-chat'
import { GlobeColor } from '@fluentui/react-icons/headless/svg/globe'
import { HeadphonesColor } from '@fluentui/react-icons/headless/svg/headphones'
import { HeartColor } from '@fluentui/react-icons/headless/svg/heart'
import { HomeColor } from '@fluentui/react-icons/headless/svg/home'
import { ImageColor } from '@fluentui/react-icons/headless/svg/image'
import { LocationRippleColor } from '@fluentui/react-icons/headless/svg/location-ripple'
import { LockClosedColor } from '@fluentui/react-icons/headless/svg/lock-closed'
import { MailColor } from '@fluentui/react-icons/headless/svg/mail'
import { NewsColor } from '@fluentui/react-icons/headless/svg/news'
import { NumberSymbolSquareColor } from '@fluentui/react-icons/headless/svg/number-symbol-square'
import { PuzzlePieceColor } from '@fluentui/react-icons/headless/svg/puzzle-piece'
import { RibbonStarColor } from '@fluentui/react-icons/headless/svg/ribbon-star'
import { SavingsColor } from '@fluentui/react-icons/headless/svg/savings'
import { ShieldColor } from '@fluentui/react-icons/headless/svg/shield'
import { SportColor } from '@fluentui/react-icons/headless/svg/sport'
import { StarColor } from '@fluentui/react-icons/headless/svg/star'
import { VideoColor } from '@fluentui/react-icons/headless/svg/video'
import { WeatherSunnyLowColor } from '@fluentui/react-icons/headless/svg/weather-sunny-low'

// 外部 app 可选的图标，清单里存键名
export const icons = {
  'app-window': AppsColor,
  globe: GlobeColor,
  puzzle: PuzzlePieceColor,
  swords: ShieldColor,
  'gamepad-2': GameChatColor,
  'book-open': BookOpenColor,
  newspaper: NewsColor,
  'graduation-cap': RibbonStarColor,
  briefcase: BriefcaseColor,
  'chart-line': DataTrendingColor,
  wallet: SavingsColor,
  calculator: NumberSymbolSquareColor,
  'shopping-cart': BuildingStoreColor,
  mail: MailColor,
  'message-circle': ChatColor,
  camera: CameraColor,
  image: ImageColor,
  film: VideoColor,
  music: HeadphonesColor,
  code: CodeColor,
  terminal: CodeBlockColor,
  database: DatabaseColor,
  cloud: CloudColor,
  lock: LockClosedColor,
  house: HomeColor,
  map: LocationRippleColor,
  plane: BeachColor,
  utensils: FoodColor,
  dumbbell: SportColor,
  leaf: WeatherSunnyLowColor,
  heart: HeartColor,
  star: StarColor,
} satisfies Record<string, FluentIcon>

export type IconName = keyof typeof icons

export const iconNames = Object.keys(icons) as IconName[]

import {
    ArrowLeftIcon as HeroArrowLeftIcon,
    ArrowPathIcon as HeroArrowPathIcon,
    ArrowRightIcon as HeroArrowRightIcon,
    Cog6ToothIcon,
    GlobeAltIcon,
    HomeIcon as HeroHomeIcon,
    ListBulletIcon,
    LockClosedIcon,
    MinusIcon,
    PaperAirplaneIcon,
    PlusIcon as HeroPlusIcon,
    SparklesIcon as HeroSparklesIcon,
    WindowIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";

type IconProps = { className?: string };

export function GlobeIcon({ className }: IconProps) {
    return <GlobeAltIcon className={className} aria-hidden="true" />;
}

export function PlusIcon({ className }: IconProps) {
    return <HeroPlusIcon className={className} aria-hidden="true" />;
}

export function CloseIcon({ className }: IconProps) {
    return <XMarkIcon className={className} aria-hidden="true" />;
}

export function SparklesIcon({ className }: IconProps) {
    return <HeroSparklesIcon className={className} aria-hidden="true" />;
}

export function CogIcon({ className }: IconProps) {
    return <Cog6ToothIcon className={className} aria-hidden="true" />;
}

export function ArrowLeftIcon({ className }: IconProps) {
    return <HeroArrowLeftIcon className={className} aria-hidden="true" />;
}

export function ArrowRightIcon({ className }: IconProps) {
    return <HeroArrowRightIcon className={className} aria-hidden="true" />;
}

export function ArrowPathIcon({ className }: IconProps) {
    return <HeroArrowPathIcon className={className} aria-hidden="true" />;
}

export function HomeIcon({ className }: IconProps) {
    return <HeroHomeIcon className={className} aria-hidden="true" />;
}

export function LockIcon({ className }: IconProps) {
    return <LockClosedIcon className={className} aria-hidden="true" />;
}

export function ListIcon({ className }: IconProps) {
    return <ListBulletIcon className={className} aria-hidden="true" />;
}

export function PaperPlaneIcon({ className }: IconProps) {
    return <PaperAirplaneIcon className={className} aria-hidden="true" />;
}

export function WinMinimizeIcon() {
    return <MinusIcon className="window-control-icon" aria-hidden="true" />;
}

export function WinMaximizeIcon() {
    return <WindowIcon className="window-control-icon" aria-hidden="true" />;
}

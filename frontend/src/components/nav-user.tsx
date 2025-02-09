"use client"

import {BadgeCheck, Bell, ChevronsUpDown, CreditCard, LogOut, Moon, Sparkles, Sun, SunMoon,} from "lucide-react"

import {Avatar, AvatarFallback, AvatarImage,} from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,} from "@/components/ui/sidebar"
import {useTheme} from "@/components/theme/theme-provider.tsx";
import {cn} from "@lib/utils/tailwind.ts";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip.tsx";
import {useAuthStore} from "@/services/auth.ts";

export function NavUser({user}: {
    user: {
        name: string
        email: string
        avatar: string
    }
}) {
    const {isMobile} = useSidebar()
    const {theme, setTheme} = useTheme()
    const {logout} = useAuthStore()

    async function handleLogout() {
        await logout()
    }

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <Avatar className="h-8 w-8 rounded-lg">
                                <AvatarImage src={user.avatar} alt={user.name}/>
                                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">{user.name}</span>
                                <span className="truncate text-xs">{user.email}</span>
                            </div>
                            <ChevronsUpDown className="ml-auto size-4"/>
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                        side={isMobile ? "bottom" : "right"}
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                <Avatar className="h-8 w-8 rounded-lg">
                                    <AvatarImage src={user.avatar} alt={user.name}/>
                                    <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                                </Avatar>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-semibold">{user.name}</span>
                                    <span className="truncate text-xs">{user.email}</span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator/>
                        <DropdownMenuGroup className="flex items-stretch justify-evenly h-10 gap-2">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DropdownMenuItem
                                        onClick={() => setTheme("light")}
                                        className={cn("flex-1 place-content-center", theme === "light" && "bg-muted text-muted-foreground")}
                                    >
                                        <Sun className="h-[1.2rem] w-[1.2rem]"/>
                                    </DropdownMenuItem>
                                </TooltipTrigger>
                                <TooltipContent side="top" align="center">
                                    Light
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DropdownMenuItem
                                        onClick={() => setTheme("dark")}
                                        className={cn("flex-1 place-content-center", theme === "dark" && "bg-muted text-muted-foreground")}
                                    >
                                        <Moon className="h-[1.2rem] w-[1.2rem]"/>
                                    </DropdownMenuItem>
                                </TooltipTrigger>
                                <TooltipContent side="top" align="center">
                                    Dark
                                </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <DropdownMenuItem
                                        onClick={() => setTheme("system")}
                                        className={cn("flex-1 place-content-center", theme === "system" && "bg-muted text-muted-foreground")}
                                    >
                                        <SunMoon className="h-[1.2rem] w-[1.2rem]"/>
                                    </DropdownMenuItem>
                                </TooltipTrigger>
                                <TooltipContent side="top" align="center">
                                    System
                                </TooltipContent>
                            </Tooltip>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator/>
                        <DropdownMenuGroup>
                            <DropdownMenuItem>
                                <Sparkles/>
                                Upgrade to Pro
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator/>
                        <DropdownMenuGroup>
                            <DropdownMenuItem>
                                <BadgeCheck/>
                                Account
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <CreditCard/>
                                Billing
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                                <Bell/>
                                Notifications
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator/>
                        <DropdownMenuItem
                            onClick={handleLogout}
                        >
                            <LogOut/>
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}

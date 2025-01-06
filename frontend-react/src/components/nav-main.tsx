"use client"

import {ChevronRight, type LucideIcon} from "lucide-react"

import {Collapsible, CollapsibleContent, CollapsibleTrigger,} from "@/components/ui/collapsible"
import {
    SidebarGroup,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {Link} from "react-router";

export function NavMain({
                            items,
                        }: {
    items: {
        title: string
        url: string
        icon?: LucideIcon
        isActive?: boolean
        items?: {
            title: string
            url: string
            isActive?: boolean
        }[]
    }[]
}) {
    const renderItem = (item: {
        title: string
        url: string
        icon?: LucideIcon
        isActive?: boolean
        items?: {
            title: string
            url: string
            isActive?: boolean
        }[]
    }) => {
        return (
            <>
                <SidebarMenuButton
                    key={item.url}
                    tooltip={item.title}
                    isActive={item.isActive}
                    className="flex items-stretch gap-2"
                    asChild={!item.isActive}
                >
                    <Link to={item.url} className="flex items-stretch gap-2 flex-shrink-0">
                        {item.icon && <item.icon className="w-4 h-4"/>}
                        <span style={{lineHeight: '100%'}}>{item.title}</span>
                    </Link>
                </SidebarMenuButton>
                {item.isActive && (item.items?.length ?? 0) > 0 && <SidebarMenuSub>
                    {item.items?.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild isActive={subItem.isActive}>
                                <Link to={subItem.url}>
                                    <span>{subItem.title}</span>
                                </Link>
                            </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                    ))}
                </SidebarMenuSub>}
            </>
        )
    }
    return (
        <SidebarGroup>
            <SidebarMenu>
                {items.map((item) => (
                    renderItem(item)
                ))}
            </SidebarMenu>
        </SidebarGroup>
    )
}

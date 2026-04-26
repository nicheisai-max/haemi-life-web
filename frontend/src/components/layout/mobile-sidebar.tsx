import React from 'react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "../ui/logo";
import { useAuth } from "@/hooks/use-auth";
import { Link } from 'react-router-dom';
import { PATHS } from '@/routes/paths';

export const MobileSidebar: React.FC = () => {
    const { user } = useAuth();
    const [open, setOpen] = React.useState(false);

    if (!user) return null;

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden haemi-ignore-click-outside">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Open Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[300px] flex flex-col bg-background/95 backdrop-blur-xl border-none">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <SheetDescription className="sr-only">
                    Access dashboard, medical records, and healthcare services.
                </SheetDescription>
                <div className="p-6">
                    <Link to={PATHS.ROOT} onClick={() => setOpen(false)}>
                        <Logo size="nav" />
                    </Link>
                </div>

                <div className="flex-1 overflow-y-auto py-6 px-4 scrollbar-none">
                    <SidebarNav onItemClick={() => setOpen(false)} />
                </div>
            </SheetContent>
        </Sheet>
    );
};

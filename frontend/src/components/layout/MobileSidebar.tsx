import React from 'react';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./SidebarNav";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "../ui/Logo";
import { useAuth } from "../../context/AuthContext";
import { Link } from 'react-router-dom';

export const MobileSidebar: React.FC = () => {
    const { user } = useAuth();
    const [open, setOpen] = React.useState(false);

    if (!user) return null;

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden mr-2">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Open Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[300px] flex flex-col bg-background/95 backdrop-blur-xl border-r border-border/40">
                <div className="p-6 border-b border-border/40">
                    <Link to="/" onClick={() => setOpen(false)}>
                        <Logo size="md" />
                    </Link>
                </div>

                <div className="flex-1 overflow-y-auto py-6 px-4 scrollbar-none">
                    <SidebarNav onItemClick={() => setOpen(false)} />
                </div>
            </SheetContent>
        </Sheet>
    );
};

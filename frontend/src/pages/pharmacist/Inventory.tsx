import React, { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Package, AlertTriangle, TrendingUp, Search, Pill, Edit, PlusCircle, Activity, Microscope, Zap, Heart, Wind, Filter } from 'lucide-react';
import { inventorySchema } from '../../lib/validation/inventory.schema';



import { PremiumNumberInput } from '@/components/ui/PremiumNumberInput';

import { TransitionItem } from '../../components/layout/PageTransition';

interface InventoryItem {
    id: string;
    name: string;
    category: string;
    stock: number;
    minStock: number;
    price: number;
    lastRestocked: string;
}

const CATEGORIES = ['Pain Relief', 'Antibiotics', 'Digestive', 'Supplements', 'Cardiovascular', 'Respiratory'];

export const Inventory: React.FC = () => {
    const [inventory, setInventory] = useState<InventoryItem[]>([
        { id: '1', name: 'Paracetamol 500mg', category: 'Pain Relief', stock: 450, minStock: 200, price: 2.50, lastRestocked: '2026-02-08' },
        { id: '2', name: 'Amoxicillin 250mg', category: 'Antibiotics', stock: 120, minStock: 150, price: 8.75, lastRestocked: '2026-02-05' },
        { id: '3', name: 'Ibuprofen 400mg', category: 'Pain Relief', stock: 380, minStock: 200, price: 3.20, lastRestocked: '2026-02-07' },
        { id: '4', name: 'Omeprazole 20mg', category: 'Digestive', stock: 95, minStock: 100, price: 5.50, lastRestocked: '2026-02-01' },
        { id: '5', name: 'Vitamin D3 1000IU', category: 'Supplements', stock: 280, minStock: 150, price: 4.00, lastRestocked: '2026-02-09' },
    ]);

    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const form = useForm<z.input<typeof inventorySchema>>({
        resolver: zodResolver(inventorySchema),
        defaultValues: {
            name: '',
            category: '',
            stock: 0,
            minStock: 0,
            price: 0,
        },
    });

    const onSubmit = (data: z.input<typeof inventorySchema>) => {
        const newItem: InventoryItem = {
            id: crypto.randomUUID(),
            name: data.name,
            category: data.category,
            stock: Number(data.stock),
            minStock: Number(data.minStock),
            price: Number(data.price),
            lastRestocked: new Date().toISOString().split('T')[0],
        };
        setInventory([newItem, ...inventory]);
        setIsDialogOpen(false);
        form.reset();
    };

    const filteredInventory = inventory.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const lowStockItems = inventory.filter(item => item.stock < item.minStock);
    const uniqueCategoriesInStock = Array.from(new Set(inventory.map(item => item.category)));
    const filterOptions = ['all', ...uniqueCategoriesInStock];

    const getStockStatus = (item: InventoryItem) => {
        if (item.stock < item.minStock) return 'low';
        if (item.stock < item.minStock * 1.5) return 'medium';
        return 'good';
    };

    return (
        <div className="space-y-8">
            <TransitionItem className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                    <h1 className="page-heading !mb-0 transition-all duration-300">Inventory Management</h1>
                    <p className="page-subheading italic">Track and manage pharmacy stock levels and reordering</p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-36">
                            <Plus className="h-4 w-4 mr-2" />
                            Add New Item
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Add New Medicine</DialogTitle>
                            <DialogDescription>
                                Enter the details of the new medicine to add it to the inventory.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Medicine Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Paracetamol" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="category"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Category</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a category" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {CATEGORIES.map(cat => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="stock"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Initial Stock</FormLabel>
                                                <FormControl>
                                                    <PremiumNumberInput
                                                        value={field.value as number}
                                                        onChange={field.onChange}
                                                        min={0}
                                                        max={100000}
                                                        id="stock"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="minStock"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Min. Stock Level</FormLabel>
                                                <FormControl>
                                                    <PremiumNumberInput
                                                        value={field.value as number}
                                                        onChange={field.onChange}
                                                        min={0}
                                                        max={10000}
                                                        id="minStock"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="price"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Price (BWP)</FormLabel>
                                            <FormControl>
                                                <PremiumNumberInput
                                                    value={field.value as number}
                                                    onChange={field.onChange}
                                                    min={0.01}
                                                    max={100000}
                                                    step={0.5}
                                                    id="price"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter className="pt-4">
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                    <Button type="submit">Add Item</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </TransitionItem>

            {/* Stats Cards */}
            <TransitionItem className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Package className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="text-h3">{inventory.length}</div>
                            <div className="text-sm text-muted-foreground font-medium">Total Items</div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="text-h3">{lowStockItems.length}</div>
                            <div className="text-sm text-muted-foreground font-medium">Low Stock Alerts</div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="text-h3">{uniqueCategoriesInStock.length}</div>
                            <div className="text-sm text-muted-foreground font-medium">Categories</div>
                        </div>
                    </CardContent>
                </Card>
            </TransitionItem>

            <TransitionItem>
                {/* Low Stock Alert */}
                {lowStockItems.length > 0 && (
                    <Alert variant="destructive" className="mb-8 border-amber-500 bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-200">
                        <div className="flex-shrink-0 flex items-center justify-center">
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1">
                            <AlertTitle>Low Stock Warning</AlertTitle>
                            <AlertDescription>
                                {lowStockItems.length} item(s) are running low on stock. Please review and restock soon.
                            </AlertDescription>
                        </div>
                    </Alert>
                )}

                {/* Filters */}
                <Card className="mb-6">
                    <CardContent className="p-6 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search medicines..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 max-w-md"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {filterOptions.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategoryFilter(cat)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${categoryFilter === cat
                                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.05]'
                                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                                        }`}
                                >
                                    {cat === 'all' && <Package className="h-3.5 w-3.5" />}
                                    {cat === 'Pain Relief' && <Pill className="h-3.5 w-3.5" />}
                                    {cat === 'Antibiotics' && <Microscope className="h-3.5 w-3.5" />}
                                    {cat === 'Digestive' && <Activity className="h-3.5 w-3.5" />}
                                    {cat === 'Supplements' && <Zap className="h-3.5 w-3.5" />}
                                    {cat === 'Cardiovascular' && <Heart className="h-3.5 w-3.5" />}
                                    {cat === 'Respiratory' && <Wind className="h-3.5 w-3.5" />}
                                    {!['all', 'Pain Relief', 'Antibiotics', 'Digestive', 'Supplements', 'Cardiovascular', 'Respiratory'].includes(cat) && <Filter className="h-3.5 w-3.5" />}
                                    <span className="capitalize">{cat}</span>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </TransitionItem>

            <TransitionItem>
                {/* Inventory Table */}
                <Card className="overflow-hidden">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Medicine</TableHead>
                                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                                    <TableHead>Stock</TableHead>
                                    <TableHead className="hidden lg:table-cell">Min. Stock</TableHead>
                                    <TableHead className="hidden md:table-cell">Price</TableHead>
                                    <TableHead className="hidden md:table-cell">Last Restocked</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredInventory.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                            No items found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredInventory.map((item) => {
                                        const status = getStockStatus(item);
                                        return (
                                            <TableRow key={item.id} className="hover:bg-muted/50">
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                            <Pill className="h-5 w-5" />
                                                        </div>
                                                        <span className="font-medium">{item.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell">{item.category}</TableCell>
                                                <TableCell>
                                                    <span className="font-semibold">{item.stock}</span> units
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell text-muted-foreground">{item.minStock}</TableCell>
                                                <TableCell className="hidden md:table-cell font-medium text-green-600 dark:text-green-400">
                                                    ${item.price.toFixed(2)}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                                                    {new Date(item.lastRestocked).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric'
                                                    })}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={status === 'low' ? 'destructive' : status === 'medium' ? 'secondary' : 'default'}
                                                        className={
                                                            status === 'good' ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' :
                                                                status === 'medium' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400' : ''
                                                        }
                                                    >
                                                        {status === 'low' ? 'Low Stock' : status === 'medium' ? 'Medium' : 'In Stock'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Restock">
                                                            <PlusCircle className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Edit">
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            </TransitionItem>
        </div>
    );
};

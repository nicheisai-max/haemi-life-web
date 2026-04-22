import React, { useState, useEffect, useCallback } from 'react';
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
import { Plus, Package, AlertTriangle, TrendingUp, Search, Pill, Edit, PlusCircle, Activity, Microscope, Zap, Heart, Wind, Filter, Loader2, Calendar } from 'lucide-react';
import { MedicalLoader } from '@/components/ui/medical-loader';

import { inventorySchema } from '../../lib/validation/inventory.schema';
import { PremiumNumberInput } from '@/components/ui/premium-number-input';
import { TransitionItem } from '../../components/layout/page-transition';
import { usePagination } from '@/hooks/use-pagination';
import { TablePagination } from '@/components/ui/table-pagination';

import { getPharmacyInventory, addPharmacyInventory } from '../../services/pharmacist.service';
import type { PharmacyInventoryEntity } from '../../types/pharmacist.types';
import { toast } from 'sonner';

const CATEGORIES = ['Pain Relief', 'Antibiotics', 'Digestive', 'Supplements', 'Cardiovascular', 'Respiratory'];

export const Inventory: React.FC = () => {
    const [inventory, setInventory] = useState<PharmacyInventoryEntity[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchMedicines = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getPharmacyInventory();
            setInventory(data);
        } catch (error) {
            console.error('Error fetching inventory:', error);
            toast.error('Failed to load medicine inventory');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMedicines();
    }, [fetchMedicines]);

    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const form = useForm<z.input<typeof inventorySchema>>({
        resolver: zodResolver(inventorySchema),
        defaultValues: {
            name: '',
            category: '',
            stock: 0,
            minStock: 10,
            price: 0,
            expiryDate: '',
        },
    });

    const onSubmit = async (data: z.input<typeof inventorySchema>) => {
        try {
            setIsSubmitting(true);
            await addPharmacyInventory({
                name: data.name,
                category: data.category,
                stock: Number(data.stock),
                minStock: Number(data.minStock),
                price: Number(data.price),
                expiryDate: data.expiryDate,
            });
            
            toast.success('Inventory updated successfully');
            setIsDialogOpen(false);
            form.reset();
            await fetchMedicines();
        } catch (error) {
            console.error('Error updating inventory:', error);
            toast.error('Failed to update inventory. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredInventory = inventory.filter(item => {
        const nameMatch = item.medicine_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const catMatch = categoryFilter === 'all' || item.medicine_category === categoryFilter;
        return nameMatch && catMatch;
    });

    const {
        currentPage,
        setCurrentPage,
        resetPage,
        totalPages,
        paginatedData: paginatedInventory,
        showPagination,
        totalItems,
        startIndex,
        endIndex,
    } = usePagination(filteredInventory);

    useEffect(() => {
        resetPage();
    }, [searchTerm, categoryFilter, resetPage]);

    const lowStockItems = inventory.filter(item => item.stock_quantity <= item.reorder_level);
    const uniqueCategoriesInStock = Array.from(new Set(inventory.map(item => item.medicine_category).filter(Boolean))) as string[];
    const filterOptions = ['all', ...uniqueCategoriesInStock];

    const getStockStatus = (item: PharmacyInventoryEntity) => {
        if (item.stock_quantity <= item.reorder_level) return 'low';
        if (item.stock_quantity <= item.reorder_level * 1.5) return 'medium';
        return 'good';
    };

    const getExpiryStatus = (dateStr: Date | string | null) => {
        if (!dateStr) return { status: 'unknown', text: 'N/A' };
        const expiry = new Date(dateStr);
        const today = new Date();
        const diffTime = expiry.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return { status: 'expired', text: 'Expired' };
        if (diffDays <= 30) return { status: 'warning', text: 'Expiring Soon' };
        return { status: 'good', text: expiry.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) };
    };

    if (loading && inventory.length === 0) {
        return <MedicalLoader message="Hydrating pharmaceutical inventories..." />;
    }

    return (
        <div className="space-y-8">
            <TransitionItem className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div>
                    <h1 className="page-heading !mb-0 transition-all duration-300">Inventory Management</h1>
                    <p className="page-subheading italic">Real-time stock levels, expiry tracking, and analytics.</p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="shrink-0 flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white hover:brightness-110 shadow-lg shadow-teal-900/20 border-0 transition-all duration-300">
                            <Plus className="h-4 w-4" />
                            Add New Item
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg rounded-[var(--card-radius)] border-primary/20 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">Add New Medicine</DialogTitle>
                            <DialogDescription className="font-medium">
                                Enter the details of the new medicine to add it to the institutional inventory.
                            </DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="font-bold text-slate-700 dark:text-slate-300">Medicine Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Paracetamol 500mg" className="rounded-[var(--card-radius)] border-slate-200 focus:ring-primary/20" {...field} />
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
                                            <FormLabel className="font-bold text-slate-700 dark:text-slate-300">Category</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="rounded-[var(--card-radius)]">
                                                        <SelectValue placeholder="Select a category" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="rounded-[var(--card-radius)]">
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
                                                <FormLabel className="font-bold text-slate-700 dark:text-slate-300">Initial Stock</FormLabel>
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
                                                <FormLabel className="font-bold text-slate-700 dark:text-slate-300">Min. Stock Level</FormLabel>
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
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="price"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-slate-700 dark:text-slate-300">Price (Pula)</FormLabel>
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
                                    <FormField
                                        control={form.control}
                                        name="expiryDate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="font-bold text-slate-700 dark:text-slate-300">Expiry Date</FormLabel>
                                                <FormControl>
                                                    <Input type="date" className="rounded-[var(--card-radius)]" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <DialogFooter className="pt-4 gap-2">
                                    <Button type="button" variant="outline" className="rounded-[var(--card-radius)]" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                                    <Button type="submit" className="rounded-[var(--card-radius)] bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                        Add to Inventory
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </TransitionItem>

            {/* Stats Cards */}
            <TransitionItem className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="hover:border-primary/50 dark:hover:border-primary/80 hover:shadow-lg hover:shadow-primary/10 dark:hover:shadow-primary/20 hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-[var(--card-radius)] bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                            <Package className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="text-h3 transition-all duration-300 group-hover:scale-105 origin-left">{inventory.length}</div>
                            <div className="text-sm text-muted-foreground font-bold uppercase tracking-widest group-hover:text-primary transition-colors">Total Items</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-red-500/50 dark:hover:border-red-500/80 hover:shadow-lg hover:shadow-red-500/10 dark:hover:shadow-red-500/20 hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-[var(--card-radius)] bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform duration-300">
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="text-h3 transition-all duration-300 group-hover:scale-105 origin-left">{lowStockItems.length}</div>
                            <div className="text-sm text-muted-foreground font-bold uppercase tracking-widest group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">Low Stock Alerts</div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="hover:border-green-500/50 dark:hover:border-green-500/80 hover:shadow-lg hover:shadow-green-500/10 dark:hover:shadow-green-500/20 hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-[var(--card-radius)] bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform duration-300">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="text-h3 transition-all duration-300 group-hover:scale-105 origin-left">{uniqueCategoriesInStock.length}</div>
                            <div className="text-sm text-muted-foreground font-bold uppercase tracking-widest group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">Categories</div>
                        </div>
                    </CardContent>
                </Card>
            </TransitionItem>

            <TransitionItem>
                {/* Low Stock Alert */}
                {lowStockItems.length > 0 && (
                    <Alert variant="destructive" className="mb-8 border-amber-500 bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-200 rounded-[var(--card-radius)]">
                        <div className="flex-shrink-0 flex items-center justify-center">
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 ml-3">
                            <AlertTitle className="font-bold">Low Stock Warning</AlertTitle>
                            <AlertDescription className="font-medium">
                                {lowStockItems.length} item(s) are running below reorder levels. Please restock immediately to prevent clinical disruption.
                            </AlertDescription>
                        </div>
                    </Alert>
                )}

                {/* Filters */}
                <Card className="mb-6 rounded-[var(--card-radius)] border-slate-100 shadow-sm">
                    <CardContent className="p-6 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search medicines by name or category..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 max-w-md rounded-[var(--card-radius)] border-slate-200"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {filterOptions.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategoryFilter(cat)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${categoryFilter === cat
                                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.05]'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
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
                <Card className="overflow-hidden rounded-[var(--card-radius)] border-slate-100 shadow-xl">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                                <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-slate-800">
                                    <TableHead className="font-bold text-slate-900 dark:text-white py-4">Medicine</TableHead>
                                    <TableHead className="hidden sm:table-cell font-bold text-slate-900 dark:text-white">Category</TableHead>
                                    <TableHead className="font-bold text-slate-900 dark:text-white">Stock</TableHead>
                                    <TableHead className="hidden lg:table-cell font-bold text-slate-900 dark:text-white">Min. Stock</TableHead>
                                    <TableHead className="hidden md:table-cell font-bold text-slate-900 dark:text-white">Price</TableHead>
                                    <TableHead className="hidden md:table-cell font-bold text-slate-900 dark:text-white">Expiry Date</TableHead>
                                    <TableHead className="font-bold text-slate-900 dark:text-white">Status</TableHead>
                                    <TableHead className="text-right font-bold text-slate-900 dark:text-white pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading && inventory.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-4">
                                                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                                                <span className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-xs">Synchronizing Clinical Ledger...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : paginatedInventory.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-32 text-center text-slate-400 font-medium">
                                            No clinical records found matching the current filters.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedInventory.map((item) => {
                                        const status = getStockStatus(item);
                                        const expiry = getExpiryStatus(item.expiry_date);
                                        return (
                                            <TableRow key={item.id} className="hover:bg-primary/5 transition-colors border-b border-slate-100 dark:border-slate-800">
                                                <TableCell className="py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-[var(--card-radius)] bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                                                            <Pill className="h-5 w-5" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-900 dark:text-white">{item.medicine_name || 'Unknown Medicine'}</span>
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">ID: {item.id.slice(0, 8)}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden sm:table-cell">
                                                    <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold">
                                                        {item.medicine_category || 'General'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className={`text-sm font-black ${status === 'low' ? 'text-destructive' : 'text-slate-900 dark:text-white'}`}>{item.stock_quantity}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase">Units</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell text-slate-500 font-bold text-xs">{item.reorder_level}</TableCell>
                                                <TableCell className="hidden md:table-cell font-black text-emerald-600 dark:text-emerald-400">
                                                    P{Number(item.price).toFixed(2)}
                                                </TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className={`h-3.5 w-3.5 ${expiry.status === 'expired' ? 'text-destructive' : expiry.status === 'warning' ? 'text-amber-500' : 'text-slate-400'}`} />
                                                        <span className={`text-xs font-bold ${expiry.status === 'expired' ? 'text-destructive' : expiry.status === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                                                            {expiry.text}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={status === 'low' ? 'destructive' : status === 'medium' ? 'secondary' : 'default'}
                                                        className={`rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                                                            status === 'good' ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                                status === 'medium' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400' : ''
                                                        }`}
                                                    >
                                                        {status === 'low' ? 'Critical' : status === 'medium' ? 'Warning' : 'Stable'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:text-primary hover:bg-primary/10" title="Restock">
                                                            <PlusCircle className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:text-primary hover:bg-primary/10" title="Edit Clinical Metadata">
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
                        <TablePagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            startIndex={startIndex}
                            endIndex={endIndex}
                            showPagination={showPagination}
                            onPageChange={setCurrentPage}
                            itemLabel="clinical items"
                        />
                    </div>
                </Card>
            </TransitionItem>
        </div>
    );
};

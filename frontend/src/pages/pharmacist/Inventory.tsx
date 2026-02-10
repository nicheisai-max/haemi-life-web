import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import './Inventory.css';

interface InventoryItem {
    id: string;
    name: string;
    category: string;
    stock: number;
    minStock: number;
    price: number;
    lastRestocked: string;
}

export const Inventory: React.FC = () => {
    const [inventory] = useState<InventoryItem[]>([
        { id: '1', name: 'Paracetamol 500mg', category: 'Pain Relief', stock: 450, minStock: 200, price: 2.50, lastRestocked: '2026-02-08' },
        { id: '2', name: 'Amoxicillin 250mg', category: 'Antibiotics', stock: 120, minStock: 150, price: 8.75, lastRestocked: '2026-02-05' },
        { id: '3', name: 'Ibuprofen 400mg', category: 'Pain Relief', stock: 380, minStock: 200, price: 3.20, lastRestocked: '2026-02-07' },
        { id: '4', name: 'Omeprazole 20mg', category: 'Digestive', stock: 95, minStock: 100, price: 5.50, lastRestocked: '2026-02-01' },
        { id: '5', name: 'Vitamin D3 1000IU', category: 'Supplements', stock: 280, minStock: 150, price: 4.00, lastRestocked: '2026-02-09' },
    ]);

    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    const filteredInventory = inventory.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const lowStockItems = inventory.filter(item => item.stock < item.minStock);
    const categories = ['all', ...Array.from(new Set(inventory.map(item => item.category)))];

    const getStockStatus = (item: InventoryItem) => {
        if (item.stock < item.minStock) return 'low';
        if (item.stock < item.minStock * 1.5) return 'medium';
        return 'good';
    };

    const getStockStatusColor = (status: string) => {
        switch (status) {
            case 'low': return 'status-low';
            case 'medium': return 'status-medium';
            case 'good': return 'status-good';
            default: return '';
        }
    };

    return (
        <div className="inventory-container fade-in">
            <div className="page-header">
                <div>
                    <h1>Inventory Management</h1>
                    <p>Track and manage pharmacy stock levels</p>
                </div>
                <Button
                    variant="primary"
                    leftIcon={<span className="material-icons-outlined">add</span>}
                >
                    Add New Item
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <Card className="stat-card">
                    <div className="stat-icon" style={{ background: 'var(--brand-primary-alpha-10)' }}>
                        <span className="material-icons-outlined" style={{ color: 'var(--brand-primary)' }}>inventory_2</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{inventory.length}</div>
                        <div className="stat-label">Total Items</div>
                    </div>
                </Card>

                <Card className="stat-card">
                    <div className="stat-icon" style={{ background: 'var(--color-error-bg)' }}>
                        <span className="material-icons-outlined" style={{ color: 'var(--color-error)' }}>warning</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{lowStockItems.length}</div>
                        <div className="stat-label">Low Stock Alerts</div>
                    </div>
                </Card>

                <Card className="stat-card">
                    <div className="stat-icon" style={{ background: 'var(--color-success-bg)' }}>
                        <span className="material-icons-outlined" style={{ color: 'var(--color-success)' }}>trending_up</span>
                    </div>
                    <div className="stat-info">
                        <div className="stat-value">{categories.length - 1}</div>
                        <div className="stat-label">Categories</div>
                    </div>
                </Card>
            </div>

            {/* Low Stock Alert */}
            {lowStockItems.length > 0 && (
                <Card className="alert alert-warning">
                    <span className="material-icons-outlined">warning</span>
                    <span>{lowStockItems.length} item(s) running low on stock. Restock soon!</span>
                </Card>
            )}

            {/* Filters */}
            <Card className="filters-card">
                <div className="search-box">
                    <span className="material-icons-outlined">search</span>
                    <input
                        type="text"
                        placeholder="Search medicines..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
                <div className="category-filters">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`category-btn ${categoryFilter === cat ? 'active' : ''}`}
                            onClick={() => setCategoryFilter(cat)}
                        >
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </button>
                    ))}
                </div>
            </Card>

            {/* Inventory Table */}
            <Card className="inventory-table-card">
                <div className="table-wrapper">
                    <table className="inventory-table">
                        <thead>
                            <tr>
                                <th>Medicine</th>
                                <th>Category</th>
                                <th>Stock</th>
                                <th>Min. Stock</th>
                                <th>Price</th>
                                <th>Last Restocked</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInventory.map((item) => {
                                const status = getStockStatus(item);
                                return (
                                    <tr key={item.id}>
                                        <td className="medicine-cell">
                                            <div className="medicine-icon">
                                                <span className="material-icons-outlined">medication</span>
                                            </div>
                                            <span>{item.name}</span>
                                        </td>
                                        <td>{item.category}</td>
                                        <td className="stock-cell">
                                            <strong>{item.stock}</strong> units
                                        </td>
                                        <td className="min-stock-cell">{item.minStock}</td>
                                        <td className="price-cell">${item.price.toFixed(2)}</td>
                                        <td className="date-cell">
                                            {new Date(item.lastRestocked).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </td>
                                        <td>
                                            <span className={`stock-badge ${getStockStatusColor(status)}`}>
                                                {status === 'low' ? 'Low Stock' : status === 'medium' ? 'Medium' : 'In Stock'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="table-actions">
                                                <button className="table-action-btn" title="Restock">
                                                    <span className="material-icons-outlined">add_circle</span>
                                                </button>
                                                <button className="table-action-btn" title="Edit">
                                                    <span className="material-icons-outlined">edit</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

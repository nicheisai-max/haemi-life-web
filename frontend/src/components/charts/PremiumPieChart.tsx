import React from 'react';
import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface PremiumPieChartProps {
    title: string;
    description?: string;
    data: any[];
    dataKey: string;
    categoryKey: string;
    height?: number;
    valuePrefix?: string;
    valueSuffix?: string;
}

const CustomTooltip = (props: any) => {
    const { active, payload, prefix, suffix } = props;
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border shadow-xl rounded-lg p-3 animate-in fade-in-0 zoom-in-95">
                <p className="text-sm font-medium text-popover-foreground mb-1">{payload[0].name}</p>
                <p className="text-sm font-bold text-primary">
                    {prefix}{payload[0].value?.toLocaleString()}{suffix}
                </p>
            </div>
        );
    }
    return null;
};

export const PremiumPieChart: React.FC<PremiumPieChartProps> = ({
    title,
    description,
    data,
    dataKey,
    categoryKey,
    height = 350,
    valuePrefix = '',
    valueSuffix = ''
}) => {
    return (
        <Card className="hover:shadow-md transition-shadow duration-300 overflow-hidden border-border/60 w-full h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold tracking-tight">{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                <div style={{ width: '100%', height: height }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey={dataKey}
                                nameKey={categoryKey}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color || `hsl(var(--primary-${(index + 1) * 100}))`} strokeWidth={0} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip prefix={valuePrefix} suffix={valueSuffix} />} />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                formatter={(value) => <span className="text-sm font-medium text-muted-foreground ml-1">{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

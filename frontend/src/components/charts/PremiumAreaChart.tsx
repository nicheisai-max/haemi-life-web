import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface PremiumAreaChartProps {
    title: string;
    description?: string;
    data: any[];
    dataKey: string;
    categoryKey: string;
    color?: string;
    height?: number;
    valuePrefix?: string;
    valueSuffix?: string;
}

const CustomTooltip = (props: any) => {
    const { active, payload, label, prefix, suffix } = props;
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border shadow-xl rounded-lg p-3 animate-in fade-in-0 zoom-in-95">
                <p className="text-sm font-medium text-popover-foreground mb-1">{label}</p>
                <p className="text-sm font-bold text-primary">
                    {prefix}{payload[0].value?.toLocaleString()}{suffix}
                </p>
            </div>
        );
    }
    return null;
};

export const PremiumAreaChart: React.FC<PremiumAreaChartProps> = ({
    title,
    description,
    data,
    dataKey,
    categoryKey,
    color = '#0E6B74', // Primary-800 from brand
    height = 350,
    valuePrefix = '',
    valueSuffix = ''
}) => {
    return (
        <Card className="hover:shadow-md transition-shadow duration-300 overflow-hidden border-border/60">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold tracking-tight">{title}</CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent>
                <div style={{ width: '100%', height: height }}>
                    <ResponsiveContainer>
                        <AreaChart
                            data={data}
                            margin={{
                                top: 10,
                                right: 30,
                                left: 0,
                                bottom: 0,
                            }}
                        >
                            <defs>
                                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
                            <XAxis
                                dataKey={categoryKey}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748B', fontSize: 12 }}
                                tickMargin={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748B', fontSize: 12 }}
                                tickFormatter={(value) => `${valuePrefix}${value}${valueSuffix}`}
                            />
                            <Tooltip
                                content={<CustomTooltip prefix={valuePrefix} suffix={valueSuffix} />}
                                cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }}
                            />
                            <Area
                                type="monotone"
                                dataKey={dataKey}
                                stroke={color}
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorGradient)"
                                animationDuration={1500}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

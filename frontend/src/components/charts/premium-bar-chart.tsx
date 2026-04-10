import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface ChartDataItem {
    [key: string]: string | number | undefined;
}

interface PremiumBarChartProps {
    title: string;
    description?: string;
    data: ChartDataItem[];
    dataKey: string;
    categoryKey: string;
    color?: string;
    height?: number;
    valuePrefix?: string;
    valueSuffix?: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ value?: number | string }>;
    label?: string;
    prefix?: string;
    suffix?: string;
}

const CustomTooltip = ({ active, payload, label, prefix, suffix }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border shadow-xl rounded-[var(--card-radius)] p-3 animate-in fade-in-0 zoom-in-95">
                <p className="text-sm font-medium text-popover-foreground mb-1">{label}</p>
                <p className="text-sm font-bold text-primary">
                    {prefix}{payload[0].value?.toLocaleString()}{suffix}
                </p>
            </div>
        );
    }
    return null;
};

export const PremiumBarChart: React.FC<PremiumBarChartProps> = ({
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
                <div style={{ width: '100%', height: height, minHeight: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            margin={{
                                top: 10,
                                right: 30,
                                left: 0,
                                bottom: 0,
                            }}
                        >
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
                                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                            />
                            <Bar
                                dataKey={dataKey}
                                fill={color}
                                radius={[6, 6, 0, 0]}
                                barSize={40}
                                animationDuration={1500}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

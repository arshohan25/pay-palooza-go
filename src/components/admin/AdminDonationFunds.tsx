import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Heart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CauseFund {
  id: string;
  cause_name: string;
  cause_icon: string | null;
  balance: number;
  total_raised: number;
  donor_count: number;
  updated_at: string;
}

export default function AdminDonationFunds() {
  const [funds, setFunds] = useState<CauseFund[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFunds = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("donation_cause_funds")
      .select("*")
      .order("total_raised", { ascending: false });
    setFunds((data as CauseFund[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchFunds(); }, []);

  const grandTotal = funds.reduce((s, f) => s + Number(f.total_raised), 0);
  const totalBalance = funds.reduce((s, f) => s + Number(f.balance), 0);
  const totalDonors = funds.reduce((s, f) => s + f.donor_count, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Heart size={18} className="text-primary" /> Donation Cause Funds
        </h2>
        <Button variant="outline" size="sm" onClick={fetchFunds} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Total Raised</p>
            <p className="text-lg font-bold text-foreground">৳{grandTotal.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Unallocated</p>
            <p className="text-lg font-bold text-foreground">৳{totalBalance.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-xs text-muted-foreground">Total Donations</p>
            <p className="text-lg font-bold text-foreground">{totalDonors.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : funds.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No donations yet. Cause funds will appear here after the first donation.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cause</TableHead>
                  <TableHead className="text-right">Total Raised</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Donations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {funds.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      <span className="mr-1.5">{f.cause_icon}</span>
                      {f.cause_name}
                    </TableCell>
                    <TableCell className="text-right font-semibold">৳{Number(f.total_raised).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="font-mono">৳{Number(f.balance).toLocaleString()}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{f.donor_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

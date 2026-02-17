import AppHeader from "@/components/AppHeader";
import BalanceCard from "@/components/BalanceCard";
import QuickActions from "@/components/QuickActions";
import PromoCard from "@/components/PromoCard";
import TransactionList from "@/components/TransactionList";
import BottomNav from "@/components/BottomNav";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 pb-24">
        <AppHeader />
        <div className="space-y-5">
          <BalanceCard />
          <QuickActions />
          <PromoCard />
          <TransactionList />
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Index;

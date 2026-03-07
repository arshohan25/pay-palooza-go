

## Plan: Export Spending Insights as PDF

### Approach
Add a "Download PDF" button to the top bar of the Spending Insights page. When clicked, it generates a multi-section PDF report using `jsPDF` and `jspdf-autotable` (both already installed).

### PDF Content Structure
1. **Header**: "EasyPay Spending Insights" title + date range
2. **Summary**: Sent/Received totals for current month with deltas
3. **Monthly Spending Table**: Bar chart data as a table (Month | Send | CashOut | Payment | Recharge | Total)
4. **Category Breakdown**: Donut data for active month as a table
5. **Top Merchants**: Name, category, amount
6. **Fee Summary**: Monthly fees table
7. **Budget Progress** (if budgets exist): Category | Limit | Spent | % Used

### UI Changes
- Add a `Download` icon button next to the page title in the top bar
- Show a loading spinner while generating

### Implementation
- Single file change: `src/pages/SpendingInsightsPage.tsx`
- Import `jsPDF` and `autoTable` from existing dependencies
- Add an async `handleExportPdf` function that builds the document using the already-computed state variables
- No database changes needed


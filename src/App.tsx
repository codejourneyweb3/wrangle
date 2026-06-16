import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { SuiProviders } from "./components/providers";
import { AppShell } from "./components/app-shell";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Marketplace from "./pages/Marketplace";
import Access from "./pages/Access";
import Requests from "./pages/Requests";
import Activity from "./pages/Activity";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiProviders>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<AppShell><Dashboard /></AppShell>} />
            <Route path="/app/upload" element={<AppShell><Upload /></AppShell>} />
            <Route path="/app/marketplace" element={<AppShell><Marketplace /></AppShell>} />
            <Route path="/app/access" element={<AppShell><Access /></AppShell>} />
            <Route path="/app/requests" element={<AppShell><Requests /></AppShell>} />
            <Route path="/app/activity" element={<AppShell><Activity /></AppShell>} />
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" position="bottom-right" />
      </SuiProviders>
    </QueryClientProvider>
  );
}

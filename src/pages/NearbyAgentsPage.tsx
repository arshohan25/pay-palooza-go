import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Loader2, Star, Copy, ArrowUpFromLine, Navigation } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import FlowHeader from "@/components/FlowHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface NearbyAgent {
  agent_id: string;
  user_id: string;
  shop_name: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  distance_km: number;
  avg_rating: number | null;
  total_ratings: number | null;
  easypay_uid: string | null;
  display_name: string;
}

declare global {
  interface Window { google?: any; __initNearbyMap?: () => void; }
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

const loadMapsScript = () => new Promise<void>((resolve, reject) => {
  if (window.google?.maps) return resolve();
  if (!BROWSER_KEY) return reject(new Error("Google Maps key missing"));
  const existing = document.querySelector<HTMLScriptElement>("script[data-gmaps]");
  if (existing) { existing.addEventListener("load", () => resolve()); return; }
  window.__initNearbyMap = () => resolve();
  const s = document.createElement("script");
  s.dataset.gmaps = "1";
  s.async = true; s.defer = true;
  const channel = TRACKING_ID ? `&channel=${TRACKING_ID}` : "";
  s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__initNearbyMap${channel}`;
  s.onerror = () => reject(new Error("Map failed to load"));
  document.head.appendChild(s);
});

const NearbyAgentsPage = () => {
  const navigate = useNavigate();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [agents, setAgents] = useState<NearbyAgent[]>([]);
  const [selected, setSelected] = useState<NearbyAgent | null>(null);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(5);

  // 1) Get user location
  useEffect(() => {
    if (!navigator.geolocation) { toast.error("Geolocation unavailable"); setLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      p => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      err => { toast.error(err.message || "Location denied"); setLoading(false); },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }, []);

  // 2) Fetch nearby agents
  useEffect(() => {
    if (!loc) return;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any).rpc("nearby_agents", {
        _lat: loc.lat, _lng: loc.lng, _radius_km: radius,
      });
      if (error) toast.error("Could not load agents");
      setAgents((data as NearbyAgent[]) ?? []);
      setLoading(false);
    })();
  }, [loc, radius]);

  // 3) Init map when location + script ready
  useEffect(() => {
    if (!loc || !mapEl.current) return;
    let cancelled = false;
    loadMapsScript().then(() => {
      if (cancelled || !mapEl.current || !window.google) return;
      mapRef.current = new window.google.maps.Map(mapEl.current, {
        center: loc, zoom: 14,
        disableDefaultUI: true, zoomControl: true, clickableIcons: false,
      });
      new window.google.maps.Marker({
        position: loc, map: mapRef.current,
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#3b82f6", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 },
        title: "You",
      });
    }).catch(e => toast.error(e.message));
    return () => { cancelled = true; };
  }, [loc]);

  // 4) Render agent markers
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = agents.map(a => {
      const m = new window.google.maps.Marker({
        position: { lat: a.latitude, lng: a.longitude },
        map: mapRef.current,
        title: a.shop_name || a.display_name,
      });
      m.addListener("click", () => setSelected(a));
      return m;
    });
  }, [agents]);

  const copyId = (uid?: string | null) => {
    if (!uid) return;
    navigator.clipboard.writeText(uid);
    toast.success("Agent ID copied");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <FlowHeader
        title="Nearby Agents"
        tagline={loc ? `${agents.length} within ${radius} km` : "Locating you…"}
        icon={MapPin}
        onBack={() => navigate(-1)}
      />

      <div className="relative flex-1">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <Loader2 size={22} className="animate-spin text-primary" />
          </div>
        )}
        <div ref={mapEl} className="w-full h-[45vh] bg-muted" />

        <div className="max-w-xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Agents</p>
            <div className="flex gap-1">
              {[2, 5, 10].map(r => (
                <button key={r} onClick={() => setRadius(r)}
                  className={`h-7 px-2.5 rounded-full text-[11px] font-semibold border ${radius === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}>
                  {r}km
                </button>
              ))}
            </div>
          </div>

          {agents.length === 0 && !loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">No open agents in this area.</p>
          ) : (
            <div className="space-y-2">
              {agents.map(a => (
                <button key={a.agent_id} onClick={() => setSelected(a)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/60 shadow-card text-left">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/12 text-emerald-500 flex items-center justify-center">
                    <MapPin size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{a.shop_name || a.display_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {a.distance_km.toFixed(2)} km · {a.address || "—"}
                    </p>
                  </div>
                  {a.avg_rating ? (
                    <div className="flex items-center gap-0.5 text-[11px] font-semibold text-foreground">
                      <Star size={12} className="fill-yellow-500 text-yellow-500" />
                      {Number(a.avg_rating).toFixed(1)}
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={o => { if (!o) setSelected(null); }}>
        <SheetContent side="bottom" className="rounded-t-3xl px-5 pb-8">
          {selected && (
            <div className="pt-2">
              <p className="text-base font-bold text-foreground">{selected.shop_name || selected.display_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{selected.address || "No address"}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-muted/60 p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Distance</p>
                  <p className="text-sm font-bold text-foreground">{selected.distance_km.toFixed(2)} km</p>
                </div>
                <div className="rounded-xl bg-muted/60 p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Agent ID</p>
                  <p className="text-sm font-bold text-foreground font-mono truncate">{selected.easypay_uid || "—"}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => copyId(selected.easypay_uid)}>
                  <Copy size={14} className="mr-1.5" /> Copy ID
                </Button>
                <Button variant="outline" className="flex-1 rounded-xl h-11"
                  onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}`, "_blank")}>
                  <Navigation size={14} className="mr-1.5" /> Directions
                </Button>
              </div>
              <Button className="w-full rounded-xl h-11 mt-2"
                onClick={() => { const uid = selected.easypay_uid ?? ""; navigate(`/agent/cashout?agent=${encodeURIComponent(uid)}`); }}>
                <ArrowUpFromLine size={14} className="mr-1.5" /> Cash out here
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default NearbyAgentsPage;

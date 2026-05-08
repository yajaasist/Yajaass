import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, Clock } from "lucide-react";

export default function RAAddressSearch({ value, onChange, placeholder, recentAddresses = [] }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef(null);

  const handleInput = (val) => {
    onChange(val, null, null);
    setShowSuggestions(true);
    if (val.length === 0 && recentAddresses.length > 0) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    if (val.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5&countrycodes=mx`;
      const res = await fetch(url, { headers: { "Accept-Language": "es" } });
      const data = await res.json();
      setSuggestions(data);
      setLoading(false);
    }, 500);
  };

  const select = (item) => {
    onChange(item.display_name, parseFloat(item.lat), parseFloat(item.lon));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const selectRecent = (recent) => {
    onChange(recent.address, recent.lat, recent.lon);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 animate-spin" />}
        <Input
          value={value}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={placeholder || "Ingresa tu dirección..."}
          className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl"
        />
      </div>
      {showSuggestions && value.length < 3 && recentAddresses.length > 0 && suggestions.length === 0 && (
        <div className="absolute z-[2000] w-full mt-1 bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          {recentAddresses.map((a, i) => (
            <button
              key={i}
              onMouseDown={() => selectRecent(a)}
              className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 border-b border-white/5 last:border-0 flex items-start gap-2"
            >
              <Clock className="w-3.5 h-3.5 text-white/30 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2">{a.address}</span>
            </button>
          ))}
        </div>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-[2000] w-full mt-1 bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={() => select(s)}
              className="w-full text-left px-4 py-3 text-sm text-white/80 hover:bg-white/10 border-b border-white/5 last:border-0 flex items-start gap-2"
            >
              <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2">{s.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

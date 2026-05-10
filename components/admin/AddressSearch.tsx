"use client";

import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

export default function AddressSearch({ value, onChange, placeholder, label }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const [confirmed, setConfirmed] = useState(!!value);
  const debounceRef = useRef(null);

  // Sync input when value prop changes externally (e.g. reset)
  useEffect(() => {
    setInputValue(value || "");
    setConfirmed(!!value);
  }, [value]);

  const search = (query) => {
    setInputValue(query);
    setConfirmed(false);
    // Clear coords when user edits text — force re-selection
    onChange(query, null);
    if (!query || query.length < 3) { setSuggestions([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "es" } });
      const data = await res.json();
      setSuggestions(data);
      setShowSuggestions(true);
      setLoading(false);
    }, 400);
  };

  const select = (item) => {
    // Build short label: road + city
    const addr = item.address || {};
    const short = [addr.road, addr.neighbourhood || addr.suburb, addr.city || addr.town || addr.village, addr.state]
      .filter(Boolean).join(", ") || item.display_name;
    setInputValue(short);
    setConfirmed(true);
    onChange(short, { lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${confirmed ? "text-emerald-500" : "text-slate-400"}`} />
        <Input
          value={inputValue}
          onChange={e => search(e.target.value)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          className={`pl-9 pr-8 ${!confirmed && inputValue ? "border-amber-400 focus:ring-amber-400" : confirmed ? "border-emerald-400" : ""}`}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />}
        {confirmed && !loading && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 text-xs">✓</span>}
      </div>
      {!confirmed && inputValue && !loading && !showSuggestions && (
        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
          <span>⚠</span> Selecciona una dirección de la lista para confirmar las coordenadas
        </p>
      )}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((item) => {
            const addr = item.address || {};
            const main = [addr.road, addr.neighbourhood || addr.suburb].filter(Boolean).join(", ") || item.display_name.split(",")[0];
            const sub = [addr.city || addr.town || addr.village, addr.state, addr.country].filter(Boolean).join(", ");
            return (
              <button
                key={item.place_id}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 flex items-start gap-2"
                onMouseDown={() => select(item)}
              >
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-slate-800 font-medium">{main}</p>
                  {sub && <p className="text-xs text-slate-400">{sub}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

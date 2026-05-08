import React from "react";
import { ALL_PAGES, DEFAULT_NAV_CONFIG } from "@/components/shared/navPages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

export default function NavConfigEditor({ value, onChange }) {
  const config = value?.length > 0 ? value : DEFAULT_NAV_CONFIG;

  const getPageGroup = (pageId) => {
    const group = config.find(g => (g.pages || []).includes(pageId));
    return group?.label || "none";
  };

  const setPageGroup = (pageId, newGroupLabel) => {
    const newConfig = config.map(g => ({
      ...g,
      pages: (g.pages || []).filter(p => p !== pageId),
    }));
    if (newGroupLabel !== "none") {
      const targetIdx = newConfig.findIndex(g => g.label === newGroupLabel);
      if (targetIdx >= 0) {
        newConfig[targetIdx] = {
          ...newConfig[targetIdx],
          pages: [...(newConfig[targetIdx].pages || []), pageId],
        };
      }
    }
    onChange(newConfig);
  };

  const addGroup = () => {
    onChange([...config, { label: "Nueva categoría", pages: [] }]);
  };

  const renameGroup = (idx, newLabel) => {
    const newConfig = [...config];
    newConfig[idx] = { ...newConfig[idx], label: newLabel };
    onChange(newConfig);
  };

  const deleteGroup = (idx) => {
    const newConfig = config.filter((_, i) => i !== idx);
    onChange(newConfig);
  };

  return (
    <div className="space-y-8">
      {/* Groups */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-800">Categorías del menú</h3>
            <p className="text-xs text-slate-400 mt-0.5">Agrega, renombra o elimina categorías del sidebar</p>
          </div>
          <Button size="sm" variant="outline" onClick={addGroup} className="rounded-lg">
            <Plus className="w-3.5 h-3.5 mr-1" /> Nueva categoría
          </Button>
        </div>
        <div className="space-y-2">
          {config.map((group, i) => (
            <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <Input
                value={group.label}
                onChange={e => renameGroup(i, e.target.value)}
                className="flex-1 h-8 text-sm bg-white"
              />
              <Badge variant="outline" className="text-xs shrink-0 whitespace-nowrap">
                {(group.pages || []).length} páginas
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                onClick={() => deleteGroup(i)}
                title="Eliminar categoría"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {config.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">
              No hay categorías. Agrega una para empezar.
            </p>
          )}
        </div>
      </div>

      {/* Pages assignment */}
      <div>
        <h3 className="font-semibold text-slate-800 mb-1">Asignación de páginas</h3>
        <p className="text-xs text-slate-400 mb-3">Elige a qué categoría pertenece cada página del sistema</p>
        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
          {ALL_PAGES.map(page => {
            const PageIcon = page.icon;
            const currentGroup = getPageGroup(page.page);
            return (
              <div key={page.page} className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 transition-colors">
                <PageIcon className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="flex-1 text-sm text-slate-700 min-w-0 truncate">{page.name}</span>
                <Select value={currentGroup} onValueChange={v => setPageGroup(page.page, v)}>
                  <SelectTrigger className="w-44 h-8 text-xs shrink-0">
                    <SelectValue placeholder="Sin categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoría</SelectItem>
                    {config.map((g, i) => (
                      <SelectItem key={i} value={g.label}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

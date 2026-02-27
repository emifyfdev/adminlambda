"use client"

import { useState } from "react"
import { Search, Eye, ArrowRight, Minus } from "lucide-react"
import { AppTopbar } from "@/components/app-topbar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { auditLogs } from "@/lib/mock-data"
import type { AuditLog, AuditAction } from "@/lib/types"

const actionColors: Record<AuditAction, string> = {
  create: "bg-emerald-100 text-emerald-800",
  update: "bg-blue-100 text-blue-800",
  delete: "bg-red-100 text-red-800",
  finalize: "bg-amber-100 text-amber-800",
  lock: "bg-gray-100 text-gray-800",
}

function JsonDiff({ before, after }: { before: Record<string, unknown> | null; after: Record<string, unknown> | null }) {
  const allKeys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]

  if (allKeys.length === 0) {
    return <p className="text-sm text-muted-foreground">No data available.</p>
  }

  return (
    <div className="space-y-1 font-mono text-xs">
      {allKeys.map((key) => {
        const bVal = before ? JSON.stringify(before[key], null, 2) : undefined
        const aVal = after ? JSON.stringify(after[key], null, 2) : undefined
        const changed = bVal !== aVal

        return (
          <div key={key} className="flex gap-2">
            <span className="w-28 shrink-0 text-muted-foreground">{key}:</span>
            <div className="flex flex-1 flex-col gap-0.5">
              {bVal !== undefined && (
                <span className={`rounded px-1 ${changed ? "bg-red-50 text-red-700 line-through" : "text-muted-foreground"}`}>
                  {bVal}
                </span>
              )}
              {aVal !== undefined && (
                <span className={`rounded px-1 ${changed ? "bg-emerald-50 text-emerald-700" : "text-muted-foreground"}`}>
                  {aVal}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AuditPage() {
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [entityFilter, setEntityFilter] = useState("all")
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const entities = [...new Set(auditLogs.map((l) => l.entity))]

  const filtered = auditLogs.filter((l) => {
    if (search && !l.description.toLowerCase().includes(search.toLowerCase()) && !l.entityId.toLowerCase().includes(search.toLowerCase())) return false
    if (actionFilter !== "all" && l.action !== actionFilter) return false
    if (entityFilter !== "all" && l.entity !== entityFilter) return false
    return true
  })

  return (
    <>
      <AppTopbar title="Audit" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search audit logs..." className="h-9 w-64 pl-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-9 w-32 text-sm"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="finalize">Finalize</SelectItem>
                <SelectItem value="lock">Lock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="h-9 w-40 text-sm"><SelectValue placeholder="Entity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {entities.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card className="border border-border shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 text-xs">Timestamp</TableHead>
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Entity</TableHead>
                    <TableHead className="text-xs">Entity ID</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="pr-4 text-right text-xs">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((log) => (
                    <TableRow key={log.id} className="h-12">
                      <TableCell className="pl-4 text-sm text-muted-foreground">
                        {new Date(log.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="text-sm">{log.userName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-xs capitalize ${actionColors[log.action]}`}>{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.entity}</TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">{log.entityId}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm">{log.description}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedLog(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>

      <Sheet open={!!selectedLog} onOpenChange={(o) => { if (!o) setSelectedLog(null) }}>
        <SheetContent className="w-[480px] overflow-y-auto">
          {selectedLog && (
            <>
              <SheetHeader>
                <SheetTitle>Audit Detail</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Action</span><Badge variant="secondary" className={`capitalize ${actionColors[selectedLog.action]}`}>{selectedLog.action}</Badge></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Entity</span><span>{selectedLog.entity}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Entity ID</span><span className="font-mono">{selectedLog.entityId}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">User</span><span>{selectedLog.userName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span>{new Date(selectedLog.timestamp).toLocaleString()}</span></div>
                </div>

                <div>
                  <p className="mb-1 text-sm font-medium">{selectedLog.description}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                      <span className="text-red-600">Before</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-emerald-600">After</span>
                    </h4>
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                      <JsonDiff before={selectedLog.before} after={selectedLog.after} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

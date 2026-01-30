"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useDecryptionRequests } from "../hooks/useDecryption"
import { Shield, Clock, CheckCircle, XCircle } from "lucide-react"

export function DecryptionRequestList() {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const { requests, isLoading } = useDecryptionRequests(statusFilter === "all" ? {} : { status: statusFilter })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" />
            待審核
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle className="w-3 h-3" />
            已核准
          </Badge>
        )
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3 h-3" />
            已拒絕
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">載入中...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("all")}
        >
          全部
        </Button>
        <Button
          variant={statusFilter === "pending" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("pending")}
        >
          待審核
        </Button>
        <Button
          variant={statusFilter === "approved" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("approved")}
        >
          已核准
        </Button>
        <Button
          variant={statusFilter === "rejected" ? "default" : "outline"}
          size="sm"
          onClick={() => setStatusFilter("rejected")}
        >
          已拒絕
        </Button>
      </div>

      {requests && requests.length > 0 ? (
        <div className="space-y-3">
          {requests.map((request: any) => (
            <Card key={request.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">
                      {request.target_type === "post" ? "貼文" : "留言"} 解密申請
                    </span>
                    {getStatusBadge(request.status)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">申請原因: {request.reason}</p>
                  <div className="text-xs text-muted-foreground">
                    申請時間: {new Date(request.created_at).toLocaleString("zh-TW")}
                  </div>
                  {request.reviewed_at && (
                    <div className="text-xs text-muted-foreground mt-1">
                      審核時間: {new Date(request.reviewed_at).toLocaleString("zh-TW")}
                      {request.review_note && ` - ${request.review_note}`}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">沒有解密申請記錄</div>
      )}
    </div>
  )
}

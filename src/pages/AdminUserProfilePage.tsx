import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * Legacy deep link `/admin/users/:uid` — redirects into the admin panel shell
 * so the profile always renders inside the admin dashboard (sidebar + header).
 */
export default function AdminUserProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/admin${uid ? `#user=${encodeURIComponent(uid)}` : "#users"}`, { replace: true });
  }, [uid, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="animate-spin text-muted-foreground" />
    </div>
  );
}

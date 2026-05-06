import {useAuthStore} from "@/services/auth.ts";
import {useServerSetup} from "@/services/server-setup.ts";
import {useNavigate} from "react-router";
import {useEffect} from "react";

export function Landing() {
    const {user, loading, checkAuth} = useAuthStore()
    const setup = useServerSetup()
    const nav = useNavigate()

    useEffect(() => {
        void checkAuth()
    }, [checkAuth]);
    useEffect(() => {
        if (loading || setup.isLoading || !setup.data) return

        if (user) {
            nav("/projects")
            return
        }

        if (!setup.data.adminRegistered) {
            nav("/register")
        } else {
            nav("/login")
        }
    }, [loading, user, setup.isLoading, setup.data, nav]);

    return (
        <>
            Forwarding...
        </>
    )
}

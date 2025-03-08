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
    }, []);
    useEffect(() => {
        console.log(loading, user, setup.data)
        if(!loading && user) {
            nav("/projects")
            // return
        }
        if (!loading && !user && setup.data) {
            if (!setup.data.adminRegistered) {
                nav("/register")
            } else {
                nav("/login")
            }
        }
    }, [setup, nav]);

    return (
        <>
            Forwarding...
        </>
    )
}


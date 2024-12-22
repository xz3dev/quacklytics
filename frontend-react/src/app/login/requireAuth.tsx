import {ReactNode, useEffect} from "react";
import {useAuthStore} from "@/services/auth.ts";
import {Navigate, useLocation} from "react-router";
import {Spinner} from "@/components/spinner.tsx";

export function RequireAuth(props: { children: ReactNode }) {
    const {user, loading} = useAuthStore()
    const location = useLocation()

    useEffect(() => {
        void useAuthStore.getState().checkAuth()
    }, [])

    if (user === null && !loading) {
        return <Navigate to="/login" state={{from: location}} replace/>
    }
    if(loading) {
        return (
            <>
                <div className="w-full h-screen flex place-content-center items-center">
                    <Spinner />
                </div>
            </>
        )
    }
    return (
        <>
            {props.children}
        </>
    )
}

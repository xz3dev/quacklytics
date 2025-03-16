import {cn} from "@lib/utils/tailwind.ts"
import {Button} from "@/components/ui/button"
import {Card, CardContent} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import birb from "@assets/birb.svg"
import {useAuthStore} from "@/services/auth.ts";
import {FormEvent, useState} from "react";
import {Link, useNavigate} from "react-router";

export function LoginForm({
                              className,
                              ...props
                          }: React.ComponentProps<"div">) {
    const {login} = useAuthStore()
    const navigate = useNavigate()
    const [error, setError] = useState<string>("")
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError("")
        const formData = new FormData(e.currentTarget)
        const email = formData.get("email") as string
        const password = formData.get("password") as string
        try {
            const newLocation: string = await login(email, password)
            navigate(newLocation)
        } catch (err) {
            setError("Login failed. Please check your credentials.")
            console.error("Login error:", err)
        }
    }
    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="overflow-hidden">
                <CardContent className="grid p-0 md:grid-cols-2">
                    <form onSubmit={handleSubmit} className="p-6 md:p-8">
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col items-center text-center">
                                <h1 className="text-2xl font-bold">Welcome back</h1>
                                <p className="text-balance text-muted-foreground">
                                    Login to your Quacklytics account
                                </p>
                            </div>
                            {error && (
                                <div className="text-sm text-red-500 text-center">
                                    {error}
                                </div>
                            )}
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="m@example.com"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">Password</Label>
                                    <a
                                        href="#"
                                        className="ml-auto text-sm underline-offset-2 hover:underline"
                                    >
                                        Forgot your password?
                                    </a>
                                </div>
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full">
                                Login
                            </Button>
                            {/*<div className="text-center text-sm">*/}
                            {/*    Don&apos;t have an account?{" "}*/}
                            {/*    <Link*/}
                            {/*        className="underline underline-offset-4"*/}
                            {/*        to="/register">*/}
                            {/*        Sign up*/}
                            {/*    </Link>*/}
                            {/*</div>*/}
                        </div>
                    </form>
                    <div className="relative hidden md:block">
                        <img
                            src={birb}
                            alt="Image"
                            className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
                        />
                    </div>
                </CardContent>
            </Card>
            <div
                className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
                By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
                and <a href="#">Privacy Policy</a>.
            </div>
        </div>
    )
}

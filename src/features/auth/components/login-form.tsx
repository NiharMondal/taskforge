"use client"

import { Button, toast } from "@heroui/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { Form } from "../../../components/form/Form"
import { FormTextField } from "../../../components/form/FormTextField"
import { LoginInput, loginSchema } from "../schemas/auth-schema"

export default function LoginForm() {
    const methods = useForm<LoginInput>({
        resolver: zodResolver(loginSchema)
    })

    const onSubmit = async (data: LoginInput) => {
        try {
            const res = await signIn("credentials", {
                email: data.email,
                password: data.password,
                redirect: false
            });
            if (res.code === "invalid_credentials") {
                toast.danger("Invalid Credentials")
            } else {
                toast.success("Logged in successfully")
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            toast.danger(error?.message || "Something went wrong")
        }
    }
    return (
        <Form methods={methods} onSubmit={onSubmit} >
            <FormTextField isRequired name="email" label="Email" placeholder="you@company.com" type="email" />
            <FormTextField isRequired name="password" label="Password" type="password" />
            <Button type="submit" className={"w-full"}>Login</Button>
        </Form>
    )
}

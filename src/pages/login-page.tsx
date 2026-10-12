import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Eye, EyeOff, Info, Loader } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // UI preview only. Replace with the authentication flow when it is connected.
    setSubmitted(true)
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-sidebar px-5 py-12">
      <div className="flex w-full max-w-sm flex-col gap-7">
        <Link to="/" className="flex items-center justify-center gap-2.5 self-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Loader className="size-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-semibold tracking-tight">Atlas</span>
        </Link>

        <Card className="[--card-spacing:--spacing(6)]">
          <CardHeader className="gap-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
            <CardDescription>Sign in to your Atlas workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-5" onSubmit={handleSubmit} onChange={() => setSubmitted(false)}>
              <div className="grid gap-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@company.com"
                  className="h-10"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="h-10 pr-11"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 text-muted-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    aria-controls="login-password"
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                </div>
              </div>
              <Button type="submit" className="h-10 w-full">
                Sign in
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
              {submitted && (
                <Alert role="status">
                  <Info aria-hidden="true" />
                  <AlertDescription>
                    Sign-in is not connected yet. You can explore the demo below.
                  </AlertDescription>
                </Alert>
              )}
            </form>
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/" className="rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
              Explore the demo
            </Link>
          </CardFooter>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          Your projects, stories and agents. One workspace.
        </p>
      </div>
    </main>
  )
}

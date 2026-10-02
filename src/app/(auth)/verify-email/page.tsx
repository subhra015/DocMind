import Link from "next/link";
import { CheckCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function VerifyEmailPage() {
  return (
    <Card className="border shadow-lg">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Verify your email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-success/10 p-4">
            <CheckCircle className="h-8 w-8 text-success" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Click the verification link in your email to activate your account.
        </p>
      </CardContent>
      <CardFooter>
        <Link href="/login" className="w-full">
          <Button variant="outline" className="w-full">
            Go to sign in
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
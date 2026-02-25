'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
// Import the client-side auth instance
import { auth } from '@/lib/firebase'; 
import { sendPasswordResetEmail } from 'firebase/auth';

export function ForgotPasswordModal() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    try {
      // Use the client-side SDK function directly
      await sendPasswordResetEmail(auth, email);
      setMessage('If an account with that email exists, a password reset link has been sent.');
      
      // Automatically close the dialog after a few seconds
      setTimeout(() => {
        setIsOpen(false);
        // Reset state for next time
        setMessage('');
        setEmail('');
      }, 5000);

    } catch (err: any) {
        // Handle potential errors, like an invalid email format
        if (err.code === 'auth/invalid-email') {
            setError('The email address is not valid.');
        } else {
            // For other errors, you might want a generic message
            // For security, you might not want to reveal if a user does not exist
            setError('An error occurred. Please try again.');
            console.error("Password Reset Error:", err);
        }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="text-sm text-blue-500 hover:underline">
          Forgot your password?
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Reset Your Password</DialogTitle>
          <DialogDescription>
            Enter your email address below. If an account exists, we will send you a link to reset your password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {message && <p className="text-sm text-green-600">{message}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit">Send Reset Link</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

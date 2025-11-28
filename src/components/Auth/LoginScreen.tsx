import React, { useRef, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import "./LoginScreen.css";

interface LoginScreenProps {
    theme: string;
}

export default function LoginScreen({ theme }: LoginScreenProps) {
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const firstNameRef = useRef<HTMLInputElement>(null);
    const lastNameRef = useRef<HTMLInputElement>(null);
    
    const { login, signup, googleSignIn, resetPassword, updateUserName, verifyEmail } = useAuth();
    
    const [isLogin, setIsLogin] = useState(true);
    const [isReset, setIsReset] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!emailRef.current?.value) return setError("Email required");
        
        // Reset Password Flow
        if (isReset) {
            try {
                setMessage("");
                setError("");
                setLoading(true);
                await resetPassword(emailRef.current.value);
                setMessage("Check your inbox for further instructions");
            } catch (err: any) {
                setError("Failed to reset password: " + err.message);
            } finally {
                setLoading(false);
            }
            return;
        }

        if (!passwordRef.current?.value) return setError("Password required");

        // Login / Signup Flow
        try {
            setError("");
            setLoading(true);
            if (isLogin) {
                await login(emailRef.current.value, passwordRef.current.value);
            } else {
                // Signup
                if (!firstNameRef.current?.value || !lastNameRef.current?.value) {
                    throw new Error("First and Last Name are required");
                }
                await signup(emailRef.current.value, passwordRef.current.value);
                await updateUserName(firstNameRef.current.value, lastNameRef.current.value);
                await verifyEmail();
                setMessage("Account created! Verification email sent.");
                // Note: Auth state change will redirect automatically in App.tsx
            }
        } catch (err: any) {
            console.error(err);
            setError("Failed to " + (isLogin ? "log in" : "create account") + ": " + err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleGoogleSignIn() {
        try {
            setError("");
            setLoading(true);
            await googleSignIn();
        } catch (err: any) {
            setError("Failed to sign in with Google: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={`auth-container ${theme}`} data-theme={theme}>
            <div className="auth-card">
                <div className="auth-title">
                    {isReset ? "Reset Password" : isLogin ? "Login" : "Sign Up"}
                </div>
                
                {error && <div className="auth-error">{error}</div>}
                {message && <div className="auth-success">{message}</div>}

                <form className="auth-form" onSubmit={handleSubmit}>
                    {!isLogin && !isReset && (
                        <>
                            <input ref={firstNameRef} className="auth-input" type="text" placeholder="First Name" required />
                            <input ref={lastNameRef} className="auth-input" type="text" placeholder="Last Name" required />
                        </>
                    )}
                    
                    <input ref={emailRef} className="auth-input" type="email" placeholder="Email" required />
                    
                    {!isReset && (
                        <input ref={passwordRef} className="auth-input" type="password" placeholder="Password" required />
                    )}

                    <button disabled={loading} className="auth-btn" type="submit">
                        {isReset ? "Reset Password" : isLogin ? "Log In" : "Sign Up"}
                    </button>
                </form>

                {!isReset && (
                    <button disabled={loading} className="auth-btn auth-google-btn" onClick={handleGoogleSignIn}>
                        Sign in with Google
                    </button>
                )}

                <div className="auth-link">
                    {isReset ? (
                        <div onClick={() => setIsReset(false)}>Back to Login</div>
                    ) : (
                        <>
                            {isLogin ? (
                                <>
                                    Need an account? <span onClick={() => {setIsLogin(false); setError("")}}>Sign Up</span>
                                    <br/><br/>
                                    <div onClick={() => {setIsReset(true); setError("")}}>Forgot Password?</div>
                                </>
                            ) : (
                                <>
                                    Already have an account? <span onClick={() => {setIsLogin(true); setError("")}}>Log In</span>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

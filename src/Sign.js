import React, { useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { app, db } from "./Firebase";
import { collection, doc, setDoc } from "firebase/firestore";

const SignInSignUp = () => {
  const [isSignUp, setIsSignUp] = useState(false);

  const toggleMode = () => setIsSignUp((prev) => !prev);

  const nameRef = useRef();
  const phoneRef = useRef();
  const emailRef = useRef();
  const passwordRef = useRef();

  const auth = getAuth(app);
  const navigate = useNavigate();

  function handleSubmit() {
    const name = nameRef.current.value;
    const email = emailRef.current.value;
    const password = passwordRef.current.value;
    const phone = phoneRef.current.value;

    createUserWithEmailAndPassword(auth, email, password).then(
      (usercredential) => {
        const userId = usercredential.user.uid;
        console.log("User created with ID:", userId);

        const rideOwner = doc(collection(db, "riderOwners"));

        setDoc(rideOwner, {
          person: name,
          email: email,
          userId: userId,
          phone: phone,
        })
          .then(() => {
            window.location.reload();
          })
          .catch((error) => {
            const errorMessage = error.message;
            console.error("Error creating user document:", errorMessage);
          });
        navigate("/");
      }
    );
  }

  function handleLogin() {
    const email = emailRef.current.value;
    const password = passwordRef.current.value;

    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        const userId = userCredential.user.uid;
        console.log("User logged in with ID:", userId);
        navigate("/");
      })
      .catch((error) => {
        const errorMessage = error.message;
        console.error("Error logging in:", errorMessage);
      });
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{isSignUp ? "Create Account" : "Welcome Back"}</h2>
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            isSignUp ? handleSubmit() : handleLogin();
          }}
        >
          {isSignUp && (
            <>
              <input
                type="text"
                ref={nameRef}
                placeholder="Full Name"
                required
              />
              <input
                type="tel"
                placeholder="Phone Number"
                ref={phoneRef}
                required
              />
            </>
          )}
          <input type="email" placeholder="Email" ref={emailRef} required />
          <input
            type="password"
            placeholder="Password"
            ref={passwordRef}
            required
          />
          {isSignUp && (
            <input type="password" placeholder="Confirm Password" required />
          )}

          <button type="submit" className="auth-btn">
            {isSignUp ? "Register" : "Login"}
          </button>
          <p className="toggle-link" onClick={toggleMode}>
            {isSignUp
              ? "Already have an account? Login"
              : "Don't have an account? Sign up"}
          </p>
          {!isSignUp && (
            <a href="#" className="forgot">
              Forgot Password?
            </a>
          )}
        </form>
      </div>
    </div>
  );
};

export default SignInSignUp;

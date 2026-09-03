import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./App.css";

const API_URL = "https://appointment-api-1p7q.onrender.com";

function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatSlotLabel(timeStr) {
  if (!timeStr) return "";
  const [hStr, mStr] = timeStr.split(":");
  let hours = parseInt(hStr, 10);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${mStr} ${ampm}`;
}

function generateDynamicSlots(startTime, endTime, intervalMinutes = 30) {
  if (!startTime || !endTime) return [];
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const slots = [];

  for (let current = start; current <= end; current += intervalMinutes) {
    const time24 = minutesToTime(current);
    slots.push({
      time: time24,
      label: formatSlotLabel(time24),
    });
  }
  return slots;
}

function getStoredJSON(key) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (err) {
    console.error(`Error reading ${key}:`, err);
    return null;
  }
}

function App() {
  // =====================================================
  // AUTH STATE
  // =====================================================
  const [token, setToken] = useState(() => localStorage.getItem("appointmentToken"));
  const [user, setUser] = useState(() => getStoredJSON("appointmentUser"));
  const [provider, setProvider] = useState(() => getStoredJSON("appointmentProvider"));
  const [providerToken, setProviderToken] = useState(() => localStorage.getItem("appointmentProviderToken"));

  const [isRegistering, setIsRegistering] = useState(false);
  const [loginType, setLoginType] = useState("patient");

  // =====================================================
  // FORM STATE (Registration)
  // =====================================================
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailType, setEmailType] = useState("personal");

  // =====================================================
  // PATIENT BOOKING STATE
  // =====================================================
  const [providers, setProviders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientPlace, setPatientPlace] = useState("");
  const [reason, setReason] = useState("");

  // =====================================================
  // RATING & FEEDBACK MODAL STATE
  // =====================================================
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedAppointmentForReview, setSelectedAppointmentForReview] = useState(null);
  const [selectedRating, setSelectedRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // =====================================================
  // TABS & UI STATUS
  // =====================================================
  const [providerAppointments, setProviderAppointments] = useState([]);
  const [patientTab, setPatientTab] = useState("upcoming");
  const [providerTab, setProviderTab] = useState("upcoming");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Selected doctor timings
  const currentProviderObj = providers.find((p) => p._id === selectedProviderId);
  const doctorMorningStart = currentProviderObj?.morningStart || "09:30";
  const doctorMorningEnd = currentProviderObj?.morningEnd || "11:00";
  const doctorEveningStart = currentProviderObj?.eveningStart || "13:30";
  const doctorEveningEnd = currentProviderObj?.eveningEnd || "15:00";

  const morningSlots = generateDynamicSlots(doctorMorningStart, doctorMorningEnd, 30);
  const eveningSlots = generateDynamicSlots(doctorEveningStart, doctorEveningEnd, 30);

  function getDoctorPerformance(providerId, providerItem) {
    if (providerItem?.averageRating !== undefined && providerItem?.totalReviews !== undefined) {
      return {
        avgRating: providerItem.totalReviews > 0 ? Number(providerItem.averageRating).toFixed(1) : "New",
        totalReviews: providerItem.totalReviews || 0,
      };
    }

    // Check both providerAppointments (Doctor View) and appointments (Patient View)
    const combinedList = providerAppointments.length > 0 ? providerAppointments : appointments;

    const reviews = combinedList.filter(
      (a) => {
        const pId = a.provider?._id || a.provider || a._id;
        const targetId = providerId || providerItem?._id;
        return (pId === targetId || String(pId) === String(targetId) || provider) && Number(a.rating) > 0;
      }
    );

    if (reviews.length === 0) {
      return { avgRating: "New", totalReviews: 0 };
    }

    const total = reviews.reduce((acc, curr) => acc + Number(curr.rating), 0);
    return {
      avgRating: (total / reviews.length).toFixed(1),
      totalReviews: reviews.length,
    };
  }

  // =====================================================
  // DATES & TIMES
  // =====================================================
  function getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function stringToDate(dateString) {
    if (!dateString) return null;
    const parts = dateString.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function dateToString(dateObject) {
    if (!dateObject) return "";
    const year = dateObject.getFullYear();
    const month = String(dateObject.getMonth() + 1).padStart(2, "0");
    const day = String(dateObject.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function handleDateChange(selectedDate) {
    if (!selectedDate) {
      setDate("");
      setTime("");
      return;
    }

    const selectedDateString = dateToString(selectedDate);
    setDate(selectedDateString);
    setMessage("");

    const dynamicToday = getTodayDate();
    const dynamicTime = getCurrentTime();

    if (selectedDateString === dynamicToday && time && time < dynamicTime) {
      setTime("");
    }
  }

  // =====================================================
  // LIFECYCLES
  // =====================================================
  useEffect(() => {
    if (token && !provider) {
      fetchProviders();
      fetchAppointments();
    }
  }, [token, provider]);

  useEffect(() => {
    if (provider && providerToken) {
      fetchProviderAppointments();
    }
  }, [provider, providerToken]);

  async function fetchProviders() {
    try {
      const response = await fetch(`${API_URL}/api/provider`);
      const data = await response.json();
      if (response.ok && data.success) {
        setProviders(data.providers || []);
      } else {
        setProviders([]);
      }
    } catch (error) {
      console.error("Failed to load providers:", error);
      setProviders([]);
    }
  }

  async function fetchAppointments() {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/api/appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setAppointments(data.appointments || []);
      } else if (response.status === 401) {
        handleLogout();
      }
    } catch (error) {
      console.error("Failed to load appointments:", error);
    }
  }

  async function fetchProviderAppointments() {
    if (!providerToken) return;
    try {
      const response = await fetch(`${API_URL}/api/provider/appointments`, {
        headers: { Authorization: `Bearer ${providerToken}` },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setProviderAppointments(data.appointments || []);
      } else if (response.status === 401) {
        setMessage("Provider session expired. Please login again.");
        handleLogout();
      } else {
        setMessage(data.message || "Failed to load provider appointments.");
      }
    } catch (error) {
      console.error("Failed to load provider appointments:", error);
      setMessage("Unable to load provider appointments.");
    }
  }

  // =====================================================
  // AUTH
  // =====================================================
  async function handleLogin(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const loginEndpoint = loginType === "provider" ? "/api/provider/login" : "/api/auth/login";
      const response = await fetch(`${API_URL}${loginEndpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Login failed. Please check your credentials.");
        return;
      }

      if (loginType === "provider") {
        if (!data.token || !data.provider) {
          setMessage("Invalid provider login response.");
          return;
        }

        localStorage.removeItem("appointmentToken");
        localStorage.removeItem("appointmentUser");
        localStorage.setItem("appointmentProviderToken", data.token);
        localStorage.setItem("appointmentProvider", JSON.stringify(data.provider));

        setToken(null);
        setUser(null);
        setProviderToken(data.token);
        setProvider(data.provider);
        setProviders([]);
        setAppointments([]);
        setProviderAppointments([]);
        setMessage("Provider login successful!");
      } else {
        if (!data.token || !data.user) {
          setMessage("Invalid patient login response.");
          return;
        }

        localStorage.removeItem("appointmentProvider");
        localStorage.removeItem("appointmentProviderToken");
        localStorage.setItem("appointmentToken", data.token);
        localStorage.setItem("appointmentUser", JSON.stringify(data.user));

        setToken(data.token);
        setUser(data.user);
        setProvider(null);
        setProviderToken(null);
        setProviderAppointments([]);
        setMessage("Login successful!");
      }

      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Login error:", error);
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, emailType }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Registration failed.");
        return;
      }

      setMessage("Registration successful! You can now login.");
      setName("");
      setEmail("");
      setPassword("");
      setEmailType("personal");
      setIsRegistering(false);
    } catch (error) {
      console.error("Registration error:", error);
      setMessage("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("appointmentToken");
    localStorage.removeItem("appointmentUser");
    localStorage.removeItem("appointmentProvider");
    localStorage.removeItem("appointmentProviderToken");

    setToken(null);
    setUser(null);
    setProvider(null);
    setProviderToken(null);
    setProviders([]);
    setAppointments([]);
    setProviderAppointments([]);
    setSelectedProviderId("");
    setDate("");
    setTime("");
    setPatientPhone("");
    setPatientPlace("");
    setReason("");
    setMessage("");
    setLoginType("patient");
    setIsRegistering(false);
  }

  // =====================================================
  // APPOINTMENT BOOKING
  // =====================================================
  async function handleBooking(event) {
    event.preventDefault();
    setMessage("");

    if (!selectedProviderId || !date || !time || !patientPhone.trim() || !patientPlace.trim()) {
      setMessage("Please fill in all required fields.");
      return;
    }

    const dynamicToday = getTodayDate();
    const dynamicTime = getCurrentTime();

    if (date < dynamicToday) {
      setMessage("Previous dates cannot be booked.");
      return;
    }

    if (date === dynamicToday && time < dynamicTime) {
      setMessage("This time slot has already passed for today.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: selectedProviderId,
          date,
          time,
          phone: patientPhone.trim(),
          place: patientPlace.trim(),
          reason: reason.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Failed to book appointment.");
        return;
      }

      setMessage("Appointment booked successfully!");
      setSelectedProviderId("");
      setDate("");
      setTime("");
      setPatientPhone("");
      setPatientPlace("");
      setReason("");
      await fetchAppointments();
    } catch (error) {
      console.error("Booking error:", error);
      setMessage("Unable to connect to the server.");
    }
  }

  async function handleProviderStatusUpdate(appointmentId, status) {
    try {
      setMessage("");
      const response = await fetch(`${API_URL}/api/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${providerToken}`,
        },
        body: JSON.stringify({ status }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Failed to update appointment status.");
        return;
      }

      setMessage(`Appointment marked as ${status} successfully.`);
      await fetchProviderAppointments();
    } catch (error) {
      console.error("Provider status update error:", error);
      setMessage("Unable to connect to the server.");
    }
  }

  async function handleCancelAppointment(appointmentId) {
    const confirmed = window.confirm("Are you sure you want to cancel this appointment?");
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/api/appointments/${appointmentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Failed to cancel appointment.");
        return;
      }

      setMessage("Appointment cancelled successfully!");
      await fetchAppointments();
    } catch (error) {
      console.error("Cancel appointment error:", error);
      setMessage("Unable to connect to the server.");
    }
  }

  // =====================================================
  // RATING & FEEDBACK SUBMISSION
  // =====================================================
  function openReviewModal(appointment) {
    setSelectedAppointmentForReview(appointment);
    setSelectedRating(appointment.rating || 5);
    setFeedbackText(appointment.feedback || "");
    setReviewModalOpen(true);
  }

  function closeReviewModal() {
    setReviewModalOpen(false);
    setSelectedAppointmentForReview(null);
    setSelectedRating(5);
    setFeedbackText("");
  }

  async function handleSubmitReview(event) {
    event.preventDefault();
    if (!selectedAppointmentForReview) return;

    setReviewSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/appointments/${selectedAppointmentForReview._id}/review`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            rating: Number(selectedRating),
            feedback: feedbackText.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Failed to submit review.");
        setReviewSubmitting(false);
        return;
      }

      setAppointments((prev) =>
        prev.map((appt) =>
          appt._id === selectedAppointmentForReview._id
            ? { ...appt, rating: Number(selectedRating), feedback: feedbackText.trim() }
            : appt
        )
      );

      closeReviewModal();
      setMessage("Thank you, visit again! Your rating and feedback have been submitted.");
      await fetchAppointments();
    } catch (error) {
      console.error("Review submission error:", error);
      setMessage("Unable to connect to server. Please try again.");
    } finally {
      setReviewSubmitting(false);
    }
  }

  // =====================================================
  // TAB FILTER ARRAYS
  // =====================================================
  const patientUpcoming = appointments.filter((a) => a.status === "pending" || a.status === "confirmed");
  const patientHistory = appointments.filter((a) => a.status === "completed" || a.status === "cancelled");

  const providerUpcoming = providerAppointments.filter((a) => a.status === "pending" || a.status === "confirmed");
  const providerHistory = providerAppointments.filter((a) => a.status === "completed" || a.status === "cancelled");

  // =====================================================
  // VIEW: PROVIDER DASHBOARD
  // =====================================================
  if (provider) {
    const currentProviderList = providerTab === "upcoming" ? providerUpcoming : providerHistory;
    const providerPerf = getDoctorPerformance(provider._id, provider);

    return (
      <div className="app">
        <header className="header">
          <div className="header-content">
            <div className="brand">
              <span className="brand-badge">Doctor Portal</span>
              <h1>Provider Dashboard</h1>
              <p>Welcome, {provider.name?.startsWith("Dr.") ? provider.name : `Dr. ${provider.name}`}</p>
            </div>
            <button className="logout-button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className="container dashboard-grid">
          <section className="card">
            <h2>Doctor Profile & Performance</h2>
            <div className="provider-details">
              <div className="profile-header">
                <div>
                  <h3>{provider.name}</h3>
                  <span className="badge">{provider.specialization || "General Medicine"}</span>
                </div>
                <div className="doctor-perf-badge large">
                  <span className="perf-star">★</span>
                  <span className="perf-rating">{providerPerf.avgRating}</span>
                  <span className="perf-count">({providerPerf.totalReviews} reviews)</span>
                </div>
              </div>
              <div className="info-grid">
                <p><strong>Email:</strong> {provider.email}</p>
                <p><strong>Organization:</strong> {provider.organization || "Hospital / Clinic"}</p>
                <p>
                  <strong>Morning Shift:</strong>{" "}
                  {formatSlotLabel(provider.morningStart || "09:30")} - {formatSlotLabel(provider.morningEnd || "11:00")}
                </p>
                <p>
                  <strong>Evening Shift:</strong>{" "}
                  {formatSlotLabel(provider.eveningStart || "13:30")} - {formatSlotLabel(provider.eveningEnd || "15:00")}
                </p>
              </div>
            </div>
          </section>

          <section className="card full-width">
            <div className="card-header-flex">
              <div>
                <h2>Patient Appointments</h2>
                <p className="subtitle">Review active consultations and patient ratings</p>
              </div>
              <button type="button" className="secondary-button" onClick={fetchProviderAppointments}>
                Refresh List
              </button>
            </div>

            <div className="tab-container">
              <button
                type="button"
                className={`tab-button ${providerTab === "upcoming" ? "active" : ""}`}
                onClick={() => setProviderTab("upcoming")}
              >
                📅 Upcoming Visits ({providerUpcoming.length})
              </button>
              <button
                type="button"
                className={`tab-button ${providerTab === "history" ? "active" : ""}`}
                onClick={() => setProviderTab("history")}
              >
                📜 Past History ({providerHistory.length})
              </button>
            </div>

            {message && <div className="message">{message}</div>}

            {currentProviderList.length === 0 ? (
              <div className="empty-state">
                <p>
                  {providerTab === "upcoming"
                    ? "No upcoming appointments scheduled."
                    : "No appointment history found."}
                </p>
              </div>
            ) : (
              <div className="appointments">
                {currentProviderList.map((appointment) => (
                  <div className="appointment" key={appointment._id}>
                    <div className="appointment-main">
                      <div className="appointment-header-row">
                        <h3>{appointment.patient?.name || "Patient"}</h3>
                        <span className={`status ${appointment.status}`}>{appointment.status}</span>
                      </div>
                      <div className="appointment-meta">
                        <span><strong>Email:</strong> {appointment.patient?.email || "N/A"}</span>
                        <span><strong>Phone:</strong> {appointment.phone || appointment.patient?.phone || "N/A"}</span>
                        <span><strong>Place:</strong> {appointment.place || "N/A"}</span>
                        <span><strong>Date:</strong> {appointment.date}</span>
                        <span><strong>Slot:</strong> {formatSlotLabel(appointment.time)}</span>
                      </div>

                      {appointment.reason && (
                        <p className="appointment-reason">
                          <strong>Reason:</strong> {appointment.reason}
                        </p>
                      )}

                      {appointment.rating && (
                        <div className="review-display-card">
                          <div className="stars-read-only">
                            {"★".repeat(appointment.rating)}
                            {"☆".repeat(5 - appointment.rating)}
                            <span className="rating-score">({appointment.rating}/5)</span>
                          </div>
                          {appointment.feedback && (
                            <p className="feedback-comment">"{appointment.feedback}"</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="appointment-actions">
                      {appointment.status === "pending" && (
                        <div className="provider-action-buttons">
                          <button
                            type="button"
                            className="accept-button"
                            onClick={() => handleProviderStatusUpdate(appointment._id, "confirmed")}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="reject-button"
                            onClick={() => handleProviderStatusUpdate(appointment._id, "cancelled")}
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {appointment.status === "confirmed" && (
                        <div className="provider-action-buttons">
                          <button
                            type="button"
                            className="complete-button"
                            onClick={() => handleProviderStatusUpdate(appointment._id, "completed")}
                          >
                            Complete Visit
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  // =====================================================
  // VIEW: AUTH
  // =====================================================
  if (!token) {
    return (
      <div className="app auth-bg">
        <header className="header">
          <div className="header-content auth-header">
            <h1>MedCare Appointments</h1>
            <p>Connect with top-rated doctors and book convenient visiting slots.</p>
          </div>
        </header>

        <main className="container auth-container">
          <section className="card login-card">
            {!isRegistering ? (
              <>
                <div className="form-heading">
                  <h2>Sign In</h2>
                  <p>Access your dashboard to book appointments</p>
                </div>

                <div className="input-group">
                  <label>Login As</label>
                  <select
                    value={loginType}
                    onChange={(e) => {
                      setLoginType(e.target.value);
                      setMessage("");
                    }}
                  >
                    <option value="patient">Patient</option>
                    <option value="provider">Doctor / Provider</option>
                  </select>
                </div>

                <form onSubmit={handleLogin}>
                  <div className="input-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                    />
                  </div>

                  <button type="submit" className="primary-btn" disabled={loading}>
                    {loading ? "Signing in..." : "Sign In"}
                  </button>
                </form>

                <p className="switch-text">
                  New patient?{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setIsRegistering(true);
                      setMessage("");
                      setLoginType("patient");
                    }}
                  >
                    Create an account
                  </button>
                </p>
              </>
            ) : (
              <>
                <div className="form-heading">
                  <h2>Create Patient Account</h2>
                  <p>Register to schedule doctor visits</p>
                </div>

                <form onSubmit={handleRegister}>
                  <div className="input-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      minLength={6}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Account Type</label>
                    <select value={emailType} onChange={(e) => setEmailType(e.target.value)}>
                      <option value="personal">Personal</option>
                      <option value="college">Student / College</option>
                      <option value="work">Work / Corporate</option>
                    </select>
                  </div>

                  <button type="submit" className="primary-btn" disabled={loading}>
                    {loading ? "Creating account..." : "Register Now"}
                  </button>
                </form>

                <p className="switch-text">
                  Already registered?{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      setIsRegistering(false);
                      setMessage("");
                    }}
                  >
                    Back to Sign In
                  </button>
                </p>
              </>
            )}

            {message && <div className="message">{message}</div>}
          </section>
        </main>
      </div>
    );
  }

  // =====================================================
  // VIEW: PATIENT DASHBOARD
  // =====================================================
  const dynamicToday = getTodayDate();
  const dynamicNowTime = getCurrentTime();
  const currentPatientList = patientTab === "upcoming" ? patientUpcoming : patientHistory;

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="brand">
            <span className="brand-badge">Patient Portal</span>
            <h1>MedCare Appointments</h1>
            <p>Welcome, {user?.name}</p>
          </div>
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="container patient-grid">
        {/* BOOKING CARD */}
        <section className="card book-card">
          <h2>Book an Appointment</h2>
          <form onSubmit={handleBooking}>
            {/* Choose Doctor */}
            <div className="input-group">
              <label>Choose Doctor *</label>
              <select
                value={selectedProviderId}
                onChange={(e) => {
                  setSelectedProviderId(e.target.value);
                  setTime("");
                }}
                required
              >
                <option value="">-- Choose a Doctor --</option>
                {providers.map((p) => {
                  const perf = getDoctorPerformance(p._id, p);
                  const perfText = perf.avgRating !== "New" ? `★ ${perf.avgRating} (${perf.totalReviews} reviews)` : "★ New";

                  return (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.specialization || "General"}) - {perfText}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Performance Card for Selected Doctor */}
            {selectedProviderId && (
              <div className="doctor-selected-perf-card">
                <div className="perf-avatar">👨‍⚕️</div>
                <div className="perf-info">
                  <h4>{currentProviderObj?.name}</h4>
                  <p className="perf-meta-text">
                    {currentProviderObj?.specialization || "General Specialist"} • {currentProviderObj?.organization || "Clinic"}
                  </p>
                  <div className="perf-rating-row">
                    <span className="perf-stars">★ {getDoctorPerformance(selectedProviderId, currentProviderObj).avgRating}</span>
                    <span className="perf-reviews-count">
                      ({getDoctorPerformance(selectedProviderId, currentProviderObj).totalReviews} verified patient ratings)
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="input-group">
              <label>Appointment Date *</label>
              <DatePicker
                selected={stringToDate(date)}
                onChange={handleDateChange}
                minDate={new Date()}
                dateFormat="dd/MM/yyyy"
                placeholderText="Click to choose appointment date"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                className="calendar-input"
                autoComplete="off"
                required
              />
              <small className="hint">Select today or a future date</small>
            </div>

            <div className="input-group">
              <label>Doctor Visiting Slots *</label>

              {!selectedProviderId ? (
                <div className="slot-notice">Please select a doctor to view their shift timings.</div>
              ) : !date ? (
                <div className="slot-notice">Please pick a date to see available time slots.</div>
              ) : (
                <div className="slots-container">
                  <div className="shift-group">
                    <div className="shift-header">
                      <span className="shift-title">☀️ Morning Shift</span>
                      <span className="shift-hours">
                        {formatSlotLabel(doctorMorningStart)} - {formatSlotLabel(doctorMorningEnd)}
                      </span>
                    </div>
                    <div className="slot-grid">
                      {morningSlots.map((slot) => {
                        const isPast = date === dynamicToday && slot.time < dynamicNowTime;
                        const isSelected = time === slot.time;

                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={isPast}
                            className={`slot-chip ${isSelected ? "selected" : ""} ${isPast ? "disabled" : ""}`}
                            onClick={() => {
                              setTime(slot.time);
                              setMessage("");
                            }}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="shift-group">
                    <div className="shift-header">
                      <span className="shift-title">🌤️ Afternoon / Evening Shift</span>
                      <span className="shift-hours">
                        {formatSlotLabel(doctorEveningStart)} - {formatSlotLabel(doctorEveningEnd)}
                      </span>
                    </div>
                    <div className="slot-grid">
                      {eveningSlots.map((slot) => {
                        const isPast = date === dynamicToday && slot.time < dynamicNowTime;
                        const isSelected = time === slot.time;

                        return (
                          <button
                            key={slot.time}
                            type="button"
                            disabled={isPast}
                            className={`slot-chip ${isSelected ? "selected" : ""} ${isPast ? "disabled" : ""}`}
                            onClick={() => {
                              setTime(slot.time);
                              setMessage("");
                            }}
                          >
                            {slot.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="input-group">
              <label>Phone Number *</label>
              <input
                type="tel"
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="e.g. +91 9876543210"
                required
              />
            </div>

            <div className="input-group">
              <label>Place / City *</label>
              <input
                type="text"
                value={patientPlace}
                onChange={(e) => setPatientPlace(e.target.value)}
                placeholder="e.g. Hyderabad / Bengaluru"
                required
              />
            </div>

            <div className="input-group">
              <label>Reason for Visit (Optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe your symptoms or notes (optional)..."
                rows="3"
              />
            </div>

            <button
              type="submit"
              className="primary-btn"
              disabled={!token || !selectedProviderId || !date || !time || !patientPhone.trim() || !patientPlace.trim()}
            >
              {time ? `Confirm Booking for ${formatSlotLabel(time)}` : "Select a Time Slot to Book"}
            </button>
          </form>

          {message && <div className="message">{message}</div>}
        </section>

        {/* RIGHT COLUMN */}
        <div className="dashboard-column">
          <section className="card">
            <h2>Available Doctors & Visiting Hours</h2>
            {providers.length === 0 ? (
              <p className="empty-text">No doctors currently listed.</p>
            ) : (
              <div className="providers-grid">
                {providers.map((p) => {
                  const mStart = p.morningStart || "09:30";
                  const mEnd = p.morningEnd || "11:00";
                  const eStart = p.eveningStart || "13:30";
                  const eEnd = p.eveningEnd || "15:00";
                  const perf = getDoctorPerformance(p._id, p);

                  return (
                    <div className="provider-card" key={p._id}>
                      <div className="provider-header">
                        <div>
                          <h3>{p.name}</h3>
                          <span className="spec-tag">{p.specialization || "General"}</span>
                        </div>
                        <div className="doctor-perf-badge">
                          <span className="perf-star">★</span>
                          <span className="perf-rating">{perf.avgRating}</span>
                          {perf.totalReviews > 0 && <span className="perf-count">({perf.totalReviews})</span>}
                        </div>
                      </div>
                      <div className="provider-meta">
                        <p><strong>Hospital:</strong> {p.organization || "Medical Clinic"}</p>
                        <p>
                          <strong>Morning:</strong> {formatSlotLabel(mStart)} - {formatSlotLabel(mEnd)}
                        </p>
                        <p>
                          <strong>Evening:</strong> {formatSlotLabel(eStart)} - {formatSlotLabel(eEnd)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* SIMPLIFIED APPOINTMENTS CARD FOR PATIENT */}
          <section className="card">
            <h2>My Scheduled Appointments</h2>

            <div className="tab-container">
              <button
                type="button"
                className={`tab-button ${patientTab === "upcoming" ? "active" : ""}`}
                onClick={() => setPatientTab("upcoming")}
              >
                📅 Upcoming ({patientUpcoming.length})
              </button>
              <button
                type="button"
                className={`tab-button ${patientTab === "history" ? "active" : ""}`}
                onClick={() => setPatientTab("history")}
              >
                📜 History ({patientHistory.length})
              </button>
            </div>

            {currentPatientList.length === 0 ? (
              <p className="empty-text">
                {patientTab === "upcoming"
                  ? "You have no upcoming appointments."
                  : "No past appointment history."}
              </p>
            ) : (
              <div className="appointments">
                {currentPatientList.map((appointment) => (
                  <div className="appointment" key={appointment._id}>
                    <div className="appointment-main">
                      {/* Doctor Name & Status Badge */}
                      <div className="appointment-header-row">
                        <h3>{appointment.provider?.name || "Dr. Specialist"}</h3>
                        <span className={`status ${appointment.status}`}>{appointment.status}</span>
                      </div>

                      {/* Date & Time Slot Only */}
                      <div className="appointment-meta">
                        <span><strong>Date:</strong> {appointment.date}</span>
                        <span><strong>Time:</strong> {formatSlotLabel(appointment.time)}</span>
                      </div>

                      {/* Note (Reason for visit) */}
                      {appointment.reason && (
                        <p className="appointment-reason">
                          <strong>Note:</strong> {appointment.reason}
                        </p>
                      )}

                      {/* Review Feedback Display in History */}
                      {appointment.rating && (
                        <div className="review-display-card">
                          <div className="stars-read-only">
                            {"★".repeat(appointment.rating)}
                            {"☆".repeat(5 - appointment.rating)}
                            <span className="rating-score">({appointment.rating}/5)</span>
                          </div>
                          {appointment.feedback && (
                            <p className="feedback-comment">"{appointment.feedback}"</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="appointment-actions">
                      {appointment.status === "pending" && (
                        <button
                          type="button"
                          className="cancel-button"
                          onClick={() => handleCancelAppointment(appointment._id)}
                        >
                          Cancel
                        </button>
                      )}

                      {appointment.status === "completed" && (
                        <button
                          type="button"
                          className="review-trigger-btn"
                          onClick={() => openReviewModal(appointment)}
                        >
                          {appointment.rating ? "★ Edit Review" : "★ Rate & Feedback"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* RATING & FEEDBACK MODAL */}
      {reviewModalOpen && (
        <div className="modal-backdrop" onClick={closeReviewModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rate Your Consultation</h3>
              <button type="button" className="close-btn" onClick={closeReviewModal}>
                &times;
              </button>
            </div>

            <p className="modal-subtitle">
              Doctor: <strong>{selectedAppointmentForReview?.provider?.name || "Doctor"}</strong>
            </p>

            <form onSubmit={handleSubmitReview}>
              <div className="rating-selector-group">
                <label>Overall Experience</label>
                <div className="star-rating-input">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      className={`star-icon ${star <= (hoverRating || selectedRating) ? "filled" : ""}`}
                      onClick={() => setSelectedRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                    >
                      ★
                    </span>
                  ))}
                  <span className="rating-text-label">
                    {selectedRating === 5 && "Excellent (5/5)"}
                    {selectedRating === 4 && "Very Good (4/5)"}
                    {selectedRating === 3 && "Good (3/5)"}
                    {selectedRating === 2 && "Fair (2/5)"}
                    {selectedRating === 1 && "Poor (1/5)"}
                  </span>
                </div>
              </div>

              <div className="input-group">
                <label>Feedback & Comments (Optional)</label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Share your experience with the consultation and clinic..."
                  rows="4"
                />
              </div>

              <div className="modal-action-buttons">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeReviewModal}
                  disabled={reviewSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={reviewSubmitting}>
                  {reviewSubmitting ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

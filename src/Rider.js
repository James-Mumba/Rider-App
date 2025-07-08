// add also a popup that on click of a rider, shows the number of days a certain rider has worked, how much income they have acrued and number of days away from work.
// have also another popup that displays a list of record of the previous months payments by who and how much in total they brought in. let each driver/ rider have their own record data

import { useEffect, useRef, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app, db } from "./Firebase";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  addDoc,
  where,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";

function Rider() {
  const auth = getAuth(app);
  const navigate = useNavigate();
  const [myRiders, setMyRiders] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [selectedRider, setSelectedRider] = useState(null);
  const [status, setStatus] = useState("Active");
  const [payment, setPayment] = useState("");
  const [notes, setNotes] = useState("");
  // const [rideOwnerName, setRideOwnerName] = useState(""); // <-- Removed unused state
  const popupRef = useRef();
  const nduthiRiderRef = useRef();
  const nduthiRegRef = useRef();
  const incomeRef = useRef();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) navigate("/Sign");
    });
    return () => unsubscribe();
  }, [auth, navigate]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userId = user.uid;
        const fetchData = async () => {
          try {
            const q = query(
              collection(db, "riders"),
              where("userId", "==", userId)
            );
            const querySnapshot = await getDocs(q);
            const newRiders = querySnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setMyRiders(newRiders);
          } catch (error) {
            console.error("Error fetching riders:", error.message);
          }
        };
        fetchData();
      }
    });
    return () => unsubscribe();
  }, [auth]);

  const addRider = () => {
    const riderName = nduthiRiderRef.current.value;
    const numberPlate = nduthiRegRef.current.value;
    const income = incomeRef.current.value;

    onAuthStateChanged(auth, (user) => {
      if (user) {
        const newRider = doc(collection(db, "riders"));
        setDoc(newRider, {
          userId: user.uid,
          name: riderName,
          registration: numberPlate,
          income,
        })
          .then(() => window.location.reload())
          .catch((error) =>
            console.error("Error adding rider:", error.message)
          );
      }
    });
  };

  const deleteRider = async (riderId) => {
    try {
      // Delete all riderReports for this rider
      const reportsQuery = query(
        collection(db, "riderReports"),
        where("riderId", "==", riderId)
      );
      // Fetch the reports snapshot
      const reportsSnapshot = await getDocs(reportsQuery);
      const deletePromises = reportsSnapshot.docs.map((docSnap) =>
        deleteDoc(docSnap.ref)
      );

      // Delete the rider document itself
      deletePromises.push(deleteDoc(doc(db, "riders", riderId)));

      await Promise.all(deletePromises);
      window.location.reload();
      window.location.reload();
    } catch (error) {
      console.error("Error deleting rider and reports:", error.message);
    }
  };

  const openPopup = (rider) => {
    setSelectedRider(rider);
    setShowPopup(true);
  };

  // State for rider reports and balances
  const [riderReports, setRiderReports] = useState([]);
  const [riderBalances] = useState({});

  // Fetch rider reports from Firestore
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "riderReports"));
        const reports = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRiderReports(reports);
      } catch (error) {
        console.error("Error fetching rider reports:", error.message);
      }
    };
    fetchReports();
  }, []);

  const submitReport = async () => {
    if (!selectedRider) {
      return alert("Select a rider first");
    }

    if (status === "Active") {
      const paymentAmount = parseInt(payment);

      if (isNaN(paymentAmount) || paymentAmount <= -1) {
        return alert("Please enter a valid payment amount greater than -1.");
      }
    }

    // Prevent duplicate submission for same day
    const today = new Date();
    const isToday = (timestamp) => {
      const date = new Date(timestamp.seconds * 1000);
      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    };

    const alreadyReported = riderReports.some(
      (rep) =>
        rep.riderId === selectedRider.id &&
        rep.createdAt &&
        isToday(rep.createdAt)
    );

    if (alreadyReported) {
      return alert("You've already submitted a report for this rider today.");
    }

    const payload = {
      riderId: selectedRider.id,
      name: selectedRider.name,
      registration: selectedRider.registration,
      income: selectedRider.income,
      status,
      payment: status === "Active" ? parseInt(payment) : null,
      notes,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, "riderReports"), payload);
      alert("Report submitted successfully!");
      setShowPopup(false);
      setPayment("");
      setNotes("");
      // Refresh rider reports after submission
      const querySnapshot = await getDocs(collection(db, "riderReports"));
      const reports = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRiderReports(reports);
    } catch (error) {
      console.error("Error submitting report:", error.message);
      alert("Submission failed. Please try again.");
    }
  };

  // after 24 hrs, incase no record has been added to a rider, a banlance equal to the income will be added to the rider's balance except for sundays (off days)
  // This will be done by a cloud function that runs every 24 hrs
  // Function to add daily balance for riders with no report for today (except Sundays)
  const addDailyBalanceIfNoReport = async () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday

    if (dayOfWeek === 0) return; // Skip Sundays

    try {
      for (const rider of myRiders) {
        // Find latest report for this rider
        const reports = riderReports
          .filter((rep) => rep.riderId === rider.id && rep.createdAt)
          .sort(
            (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
          );
        const lastReport = reports[0];
        const lastReportDate = lastReport
          ? new Date(lastReport.createdAt.seconds * 1000)
          : null;

        // If no report for today, add a missed payment report
        if (
          !lastReportDate ||
          lastReportDate.getFullYear() !== today.getFullYear() ||
          lastReportDate.getMonth() !== today.getMonth() ||
          lastReportDate.getDate() !== today.getDate()
        ) {
          // Add a report with status "Missed" and payment = 0, and update balance
          await addDoc(collection(db, "riderReports"), {
            riderId: rider.id,
            name: rider.name,
            registration: rider.registration,
            income: rider.income,
            status: "Missed",
            payment: 0,
            notes: "Auto-added: No report submitted for today.",
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      console.error("Error auto-adding daily balance:", error.message);
    }
  };

  // Call the function once when component mounts (simulate daily run)
  useEffect(() => {
    addDailyBalanceIfNoReport();
    // eslint-disable-next-line
  }, [myRiders, riderReports]);

  // State for controlling the Add Rider button and its position
  const [showAddBtn, setShowAddBtn] = useState(false);
  const [btnPosition, setBtnPosition] = useState({
    top: 0,
    left: 0,
    position: "static",
  });

  // Helper to check if all fields are filled
  const allFieldsFilled = () => {
    return (
      nduthiRiderRef.current &&
      nduthiRegRef.current &&
      incomeRef.current &&
      nduthiRiderRef.current.value.trim() &&
      nduthiRegRef.current.value.trim() &&
      incomeRef.current.value.trim()
    );
  };

  // Check fields on input
  const handleInputChange = () => {
    setShowAddBtn(
      nduthiRiderRef.current.value ||
        nduthiRegRef.current.value ||
        incomeRef.current.value
    );
    // If all fields filled, reset button position
    if (allFieldsFilled()) {
      setBtnPosition({ top: 0, left: 0, position: "static" });
    }
  };

  // --- Rider History Popup State ---
  const [showHistoryPopup, setShowHistoryPopup] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyRider, setHistoryRider] = useState(null);

  // Helper: Get paginated monthly reports for a rider
  const getMonthlyReports = (riderId, page = 1) => {
    // Group by month/year
    const reports = riderReports
      .filter((rep) => rep.riderId === riderId && rep.createdAt)
      .sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      );

    // Group by month
    const months = {};
    reports.forEach((rep) => {
      const date = new Date(rep.createdAt.seconds * 1000);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      if (!months[key]) months[key] = [];
      months[key].push(rep);
    });

    // Convert to array of months, newest first
    const monthKeys = Object.keys(months).sort((a, b) => (a < b ? 1 : -1));
    // 1 month per page
    const pagedKey = monthKeys[page - 1];
    return {
      month: pagedKey,
      reports: pagedKey ? months[pagedKey] : [],
      totalPages: monthKeys.length,
    };
  };

  // Handler: Open history popup for a rider
  const openHistoryPopup = (rider) => {
    setHistoryRider(rider);
    setHistoryPage(1);
    setShowHistoryPopup(true);
  };

  // Handler: Change history page
  const handleHistoryPage = (delta) => {
    setHistoryPage((prev) => prev + delta);
  };

  // Logout function
  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate("/Sign");
    } catch (error) {
      alert("Logout failed. Please try again.");
    }
  };

  return (
    <>
      <div className="rider">
        <div className="wrapper">
          <div className="rider-recorder">
            <h4>Add A Rider</h4>
            <div className="form" style={{ position: "relative" }}>
              <div className="userImage"></div>
              <div className="form-group-input">
                <input
                  type="text"
                  id="riderName"
                  ref={nduthiRiderRef}
                  placeholder="Enter rider name"
                  onInput={handleInputChange}
                />
                <input
                  type="text"
                  id="registration"
                  ref={nduthiRegRef}
                  placeholder="Enter Reg No"
                  onInput={handleInputChange}
                />
                <input
                  type="number"
                  id="riderIncome"
                  ref={incomeRef}
                  placeholder="Set Income"
                  onInput={handleInputChange}
                />
              </div>
              <div className="form-group"></div>
              {showAddBtn && (
                <button
                  className="btn"
                  style={btnPosition}
                  onClick={addRider}
                  disabled={!allFieldsFilled()}
                >
                  Add Rider
                </button>
              )}
              <button
                className="logout-btn"
                onClick={handleLogout}
                onMouseOver={(e) =>
                  (e.currentTarget.style.backgroundColor = "teal")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.backgroundColor = "tomato")
                }
              >
                Log Out
              </button>
            </div>
          </div>
          <div className="rider-list">
            <h4>Rider List</h4>
            <table>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Name</th>
                  <th>Reg No</th>
                  <th>Bike Status</th>
                  <th>Income</th>
                  <th>Action</th>
                  <th>Dismiss</th>
                  {/* <th>History</th> */}
                </tr>
              </thead>
              <tbody>
                {myRiders.length ? (
                  myRiders.map((rider, i) => (
                    <tr key={rider.id}>
                      <td>{i + 1}</td>
                      <td>{rider.name}</td>
                      <td>{rider.registration}</td>
                      <td>
                        <select>
                          <option>Active</option>
                          <option>Maintenance</option>
                        </select>
                      </td>
                      <td>
                        <input type="text" value={rider.income} readOnly />
                      </td>
                      <td>
                        <button
                          className="record"
                          onClick={() => openPopup(rider)}
                        >
                          Record
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => deleteRider(rider.id)}
                          style={{
                            backgroundColor: "#ef4444",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            padding: "6px 14px",
                            cursor: "pointer",
                            fontWeight: "bold",
                            transition: "background 0.2s",
                          }}
                          onMouseOver={(e) =>
                            (e.currentTarget.style.backgroundColor = "#dc2626")
                          }
                          onMouseOut={(e) =>
                            (e.currentTarget.style.backgroundColor = "#ef4444")
                          }
                        >
                          Dismiss
                        </button>
                      </td>
                      {/* <td>
                              <button
                                onClick={() => openHistoryPopup(rider)}
                                style={{ fontSize: "0.9em" }}
                              >
                                History
                              </button>
                              </td> */}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="8"
                      style={{
                        textAlign: "center",
                        fontFamily: "fantasy",
                        fontSize: "24px",
                      }}
                    >
                      No riders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rider History Popup */}
        {showHistoryPopup && historyRider && (
          <div className="popup-recorder" ref={popupRef}>
            <h4>{historyRider.name}'s Monthly History</h4>
            {(() => {
              const { month, reports, totalPages } = getMonthlyReports(
                historyRider.id,
                historyPage
              );
              if (!month) return <p>No history found.</p>;
              const [year, m] = month.split("-");
              const monthName = new Date(year, m - 1).toLocaleString(
                "default",
                {
                  month: "long",
                }
              );
              return (
                <>
                  <div style={{ marginBottom: 10 }}>
                    <strong>
                      {monthName} {year}
                    </strong>
                  </div>
                  <table style={{ width: "100%", marginBottom: 10 }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Paid</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((rep) => (
                        <tr key={rep.id}>
                          <td>
                            {rep.createdAt
                              ? new Date(
                                  rep.createdAt.seconds * 1000
                                ).toLocaleDateString()
                              : ""}
                          </td>
                          <td>{rep.status}</td>
                          <td>{rep.payment}</td>
                          <td>{rep.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ marginBottom: 10 }}></div>
                  <span>
                    <strong>
                      Days Worked:{" "}
                      {reports.filter((r) => r.status === "Active").length}
                    </strong>
                    {" | "}
                    <strong>
                      Off Days:{" "}
                      {reports.filter((r) => r.status === "Off Duty").length}
                    </strong>
                    {" | "}
                    <strong>
                      Maintenance:{" "}
                      {reports.filter((r) => r.status === "Maintenance").length}
                    </strong>
                  </span>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      disabled={historyPage <= 1}
                      onClick={() => handleHistoryPage(-1)}
                    >
                      Prev
                    </button>
                    <span>
                      Page {historyPage} of {totalPages}
                    </span>
                    <button
                      disabled={historyPage >= totalPages}
                      onClick={() => handleHistoryPage(1)}
                    >
                      Next
                    </button>
                  </div>
                </>
              );
            })()}
            <div style={{ marginTop: 15 }}>
              <button
                className="close-btn"
                onClick={() => setShowHistoryPopup(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}

        {showPopup && selectedRider && (
          <div className="popup-recorder" ref={popupRef}>
            <h4>Rider Report: {selectedRider.name}</h4>
            <p>
              <strong>Reg No:</strong> {selectedRider.registration}
            </p>
            <p>
              <strong>Agreed Monthly Income:</strong> Ksh {selectedRider.income}
            </p>

            <label>Status for Today:</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Active</option>
              <option>Off Duty</option>
              <option>Maintenance</option>
            </select>

            <label>Today's Payment:</label>
            <input
              className="payment-input"
              style={{ width: "94%", height: "40px", padding: "0 10px" }}
              type="number"
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              placeholder="Enter amount..."
              disabled={status !== "Active"}
            />

            <label>Notes:</label>
            <textarea
              className="notes-textarea"
              style={{ width: "94%", height: "20px", padding: "10px" }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            ></textarea>

            <div className="stats">
              <h5>Monthly Stats</h5>
              <p>
                Days Worked:{" "}
                {
                  riderReports.filter(
                    (rep) =>
                      rep.riderId === selectedRider.id &&
                      rep.status === "Active"
                  ).length
                }
              </p>
              <p>
                Days Missed:{" "}
                {
                  riderReports.filter(
                    (rep) =>
                      rep.riderId === selectedRider.id &&
                      rep.status === "Off Duty"
                  ).length
                }
              </p>
              <p>
                Under Maintenance:{" "}
                {
                  riderReports.filter(
                    (rep) =>
                      rep.riderId === selectedRider.id &&
                      rep.status === "Maintenance"
                  ).length
                }
              </p>
              <p>
                Total Expected: Ksh{" "}
                {(parseInt(selectedRider.income) || 0) *
                  riderReports.filter(
                    (rep) =>
                      rep.riderId === selectedRider.id &&
                      (rep.status === "Active" ||
                        rep.status === "Maintenance" ||
                        rep.status === "Off Duty")
                  ).length}
              </p>
              <p>
                Total Paid So Far: Ksh{" "}
                {riderReports
                  .filter((rep) => rep.riderId === selectedRider.id)
                  .reduce((sum, rep) => sum + (parseInt(rep.payment) || 0), 0)}
              </p>
              <p>Current Balance: Ksh {riderBalances[selectedRider.id] || 0}</p>
            </div>

            <div className="actions">
              <button className="submit-btn" onClick={submitReport}>
                Submit
              </button>
              <button className="close-btn" onClick={() => setShowPopup(false)}>
                Close
              </button>
            </div>

            {/* <div className="history">
                    <h5>Payment History</h5>
                    <table>
                    <thead>
                      <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Paid</th>
                      <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riderReports
                      .filter((rep) => rep.riderId === selectedRider.id)
                      .sort(
                        (a, b) =>
                        (b.createdAt?.seconds || 0) - 
                        (a.createdAt?.seconds || 0)
                      )
                      .map((rep) => (
                        <tr key={rep.id}>
                        <td>
                          {rep.createdAt
                          ? new Date(
                            rep.createdAt.seconds * 1000
                            ).toLocaleDateString()
                          : ""}
                        </td>
                        <td>{rep.status}</td>
                        <td>{rep.payment}</td>
                        <td>{rep.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div> */}
          </div>
        )}
        <div className="list-beneath">
          <div className="left">
            <h4>Records</h4>
            <table
              style={{
                borderCollapse: "collapse",
                width: "90%",
                background: "#f9fafb",
              }}
            >
              <thead>
                <tr style={{ background: "#e0e7ff", color: "#1e3a8a" }}>
                  <th style={{ padding: "10px", border: "1px solid #cbd5e0" }}>
                    Name
                  </th>
                  <th style={{ padding: "10px", border: "1px solid #cbd5e0" }}>
                    Reg No
                  </th>
                  <th style={{ padding: "10px", border: "1px solid #cbd5e0" }}>
                    Total Paid
                  </th>
                  <th style={{ padding: "10px", border: "1px solid #cbd5e0" }}>
                    Expected
                  </th>
                  <th style={{ padding: "10px", border: "1px solid #cbd5e0" }}>
                    Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                {myRiders.map((rider) => {
                  // Get all reports for this rider
                  const reports = riderReports.filter(
                    (r) => r.riderId === rider.id
                  );
                  // Total paid so far
                  const totalPaid = reports.reduce(
                    (sum, r) => sum + (parseInt(r.payment) || 0),
                    0
                  );
                  // The agreed upon amount at registration is a constant
                    const expected = parseInt(rider.income) || 0;

                    // Calculate balance: only "Active" days accrue expected payment
                    // For "Maintenance" or "Off Duty", no expected payment, so balance for those days is 0
                    // If there was a previous balance (from underpayment/overpayment), it is carried forward
                    // We'll accumulate the running balance day by day
                    let runningBalance = 0;
                    reports
                    .sort(
                      (a, b) =>
                      (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
                    )
                    .forEach((rep) => {
                      if (rep.status === "Active") {
                      runningBalance += expected - (parseInt(rep.payment) || 0);
                      } else if (
                      rep.status === "Maintenance" ||
                      rep.status === "Off Duty"
                      ) {
                      // No expected payment, so only subtract what was paid (if any)
                      runningBalance -= parseInt(rep.payment) || 0;
                      } else {
                      // For any other status, treat as no expected payment
                      runningBalance -= parseInt(rep.payment) || 0;
                      }
                    });

                    let balanceValue = runningBalance;
                    let balanceDisplay = `Ksh ${balanceValue}`;
                    let balanceColor = "green";
                    if (balanceValue > 0) {
                    balanceColor = "red";
                    } else if (balanceValue < 0) {
                    // Overpaid: show + and distribute excess to coming days
                    balanceColor = "green";
                    balanceDisplay = `+Ksh ${Math.abs(balanceValue)}`;
                    }
                  return (
                    <tr
                      key={rider.id}
                      style={{
                        borderBottom: "1px solid #e5e7eb",
                        cursor: "pointer",
                        color: "#2563eb",
                      }}
                      onClick={() => openHistoryPopup(rider)}
                      title="View Rider History"
                    >
                      <td style={{ padding: "8px" }}>{rider.name}</td>
                      <td style={{ padding: "8px" }}>{rider.registration}</td>
                      <td style={{ padding: "8px" }}>Ksh {totalPaid}</td>
                      <td style={{ padding: "8px" }}>Ksh {expected}</td>
                      <td
                        style={{
                          padding: "8px",
                          color: balanceColor,
                          fontWeight: "bold",
                        }}
                        title={
                          balanceValue < 0
                            ? "Overpayment will be distributed to future days"
                            : undefined
                        }
                      >
                        {balanceDisplay}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="right">
            <h4>Rider Earnings</h4>
            <div
              className="earnings"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div className="earning">
                <span>Total Earnings</span>
                <span>
                  Ksh{" "}
                  {myRiders.reduce(
                    (sum, rider) =>
                      sum +
                      riderReports
                        .filter((rep) => rep.riderId === rider.id)
                        .reduce(
                          (s, rep) => s + (parseInt(rep.payment) || 0),
                          0
                        ),
                    0
                  )}
                </span>
              </div>
              <div className="earning">
                <span>Active Riders</span>
                <span>
                  {
                    myRiders.filter((rider) => {
                      const lastRep = riderReports
                        .filter((rep) => rep.riderId === rider.id)
                        .sort(
                          (a, b) =>
                            (b.createdAt?.seconds || 0) -
                            (a.createdAt?.seconds || 0)
                        )[0];
                      return (lastRep ? lastRep.status : "Active") === "Active";
                    }).length
                  }
                </span>
              </div>
              <div className="earning">
                <span>Maintenance Riders</span>
                <span>
                  {
                    myRiders.filter((rider) => {
                      const lastRep = riderReports
                        .filter((rep) => rep.riderId === rider.id)
                        .sort(
                          (a, b) =>
                            (b.createdAt?.seconds || 0) -
                            (a.createdAt?.seconds || 0)
                        )[0];
                      return (
                        (lastRep ? lastRep.status : "Active") === "Maintenance"
                      );
                    }).length
                  }
                </span>
              </div>
              <div className="earning">
                <span>Average Earnings</span>
                <span>
                  Ksh{" "}
                  {myRiders.length
                    ? Math.round(
                        myRiders.reduce(
                          (sum, rider) =>
                            sum +
                            riderReports
                              .filter((rep) => rep.riderId === rider.id)
                              .reduce(
                                (s, rep) => s + (parseInt(rep.payment) || 0),
                                0
                              ),
                          0
                        ) / myRiders.length
                      )
                    : 0}
                </span>
              </div>
              <div className="weekly-rider-earnings">
                {myRiders.map((rider) => (
                  <div className="rider-earning" key={rider.id}>
                    <span className="rider-name" title={rider.name}>
                      {rider.name}
                    </span>
                    <span style={{ fontSize: "0.95em" }}>
                      Ksh{" "}
                      {riderReports
                        .filter((rep) => rep.riderId === rider.id)
                        .reduce(
                          (sum, rep) => sum + (parseInt(rep.payment) || 0),
                          0
                        )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Rider;

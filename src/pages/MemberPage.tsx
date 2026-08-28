import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MemberPanel from "../components/MemberPanel";
import { Customer } from "../data/customers";
import { fetchCustomers } from "../data/customersApi";

const MemberPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    fetchCustomers().then(setCustomers);
  }, []);

  const customerIdParam = searchParams.get("customerId");
  const initialCustomerId = customerIdParam ? Number(customerIdParam) : undefined;

  return (
    <div style={{ minHeight: "100vh", background: "#F5F7F5" }}>
      <MemberPanel
        open={true}
        onClose={() => navigate("/")}
        customers={customers}
        initialCustomerId={initialCustomerId}
        onMemberAdded={(newCustomer) =>
          setCustomers((prev) => [newCustomer, ...prev])
        }
        onCustomerUpdated={(updated) =>
          setCustomers((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c)),
          )
        }
      />
    </div>
  );
};

export default MemberPage;


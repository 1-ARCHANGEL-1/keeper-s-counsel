import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Keeper } from "@/components/Keeper";
import { loadState, saveState, resetState, type Speaker } from "@/lib/keeper-state";

export const Route = createFileRoute("/who")({
  head: () => ({ meta: [{ title: "Who's talking — Keeper" }] }),
  component: Who,
});

function Who() {
  const navigate = useNavigate();
  const [nameA, setNameA] = useState("Person A");
  const [nameB, setNameB] = useState("Person B");
  const [doneA, setDoneA] = useState(false);
  const [doneB, setDoneB] = useState(false);

  useEffect(() => {
    const s = loadState();
    setNameA(s.A.name);
    setNameB(s.B.name);
    setDoneA(s.A.done);
    setDoneB(s.B.done);
  }, []);

  function start(speaker: Speaker) {
    const s = loadState();
    s.A.name = nameA.trim() || "Person A";
    s.B.name = nameB.trim() || "Person B";
    saveState(s);
    navigate({ to: "/talk", search: { who: speaker } });
  }

  function startFresh() {
    resetState();
    setNameA("Person A");
    setNameB("Person B");
    setDoneA(false);
    setDoneB(false);
  }

  return (
    
      {/* Back to home — top-left, consistent with the /talk page */}
      
         Home
      

      


        
      

        
      

          Who's talking first?
        

        
      

          Keeper will listen to your side first. Nothing is shared until you're both done.
        


        
      

           start("A")}
            accent="coral"
          />
           start("B")}
            accent="periwinkle"
          />
        


        {doneA && doneB && (
          


            
              See what Keeper shared
            
          

        )}

        
      

          
            clear and start over
          
        
      

    
  );
}

function PersonCard({
  label, name, onName, done, onStart, accent,
}: {
  label: string;
  name: string;
  onName: (v: string) => void;
  done: boolean;
  onStart: () => void;
  accent: "coral" | "periwinkle";
  disabled?: boolean;
}) {
  const ring = accent === "coral" ? "focus-within:ring-[color:var(--coral)]" : "focus-within:ring-[color:var(--periwinkle)]";
  const btn = accent === "coral"
    ? "bg-[color:var(--coral)] text-primary-foreground"
    : "bg-[color:var(--periwinkle)] text-accent-foreground";
  return (
    


      


        
{label}


         onName(e.target.value)}
          className="mt-1 w-full bg-transparent text-lg font-display font-medium outline-none"
          aria-label="Your name"
        />
        {done && 

already talked to Keeper

}
      


      
        {done ? "talk again" : "start"}
      
    


  );
}
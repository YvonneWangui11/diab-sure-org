import { useState } from 'react';
import { MessageCircle, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AskYvonneForClinicians } from './AskYvonneForClinicians';
import yvonneAvatar from '@/assets/yvonne-avatar.png';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ClinicianYvonneButtonProps {
  context?: {
    patientId?: string;
    patientName?: string;
    currentPage?: string;
  };
}

export const ClinicianYvonneButton = ({ context }: ClinicianYvonneButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setIsOpen(true)}
              className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 z-50 p-0 overflow-hidden border-2 border-white/20 bg-gradient-to-br from-primary to-secondary"
              aria-label="Ask Dr. Yvonne for Help"
            >
              <div className="relative w-full h-full flex items-center justify-center">
                <img 
                  src={yvonneAvatar} 
                  alt="Dr. Yvonne" 
                  className="h-full w-full object-cover"
                />
                <div className="absolute -top-1 -right-1 h-5 w-5 bg-success rounded-full border-2 border-background flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-success-foreground" />
                </div>
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="bg-card border-border">
            <p className="font-medium">Need help?</p>
            <p className="text-xs text-muted-foreground">Ask Dr. Yvonne for app guidance</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl h-[85vh] p-0 overflow-hidden border-2">
          <div className="h-full flex flex-col bg-gradient-to-b from-background to-muted/10">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-card/50 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img 
                    src={yvonneAvatar} 
                    alt="Dr. Yvonne" 
                    className="h-12 w-12 rounded-full border-2 border-primary/20 shadow-lg"
                  />
                  <div className="absolute bottom-0 right-0 h-3 w-3 bg-success rounded-full border-2 border-background"></div>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    Dr. Yvonne
                    <span className="text-xs font-normal bg-secondary/20 text-secondary px-2 py-0.5 rounded-full">
                      Clinician Mode
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 bg-success rounded-full animate-pulse"></span>
                    App guidance & education support
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AskYvonneForClinicians context={context} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

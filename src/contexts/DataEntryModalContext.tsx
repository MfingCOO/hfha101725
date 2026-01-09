'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

// Defines the types of modals that can be opened.
export type ModalType = 'hydration' | 'sleep' | 'cravings' | 'stress' | 'activity' | 'measurements' | 'nutrition' | 'planner' | 'protocol' | 'insights' | null;

// This is the shape of the data that the context will hold.
interface ModalState {
  type: ModalType;
  initialData?: any;
}

// The context provides isOpen, the type, initialData, and updated open/close functions.
interface DataEntryModalContextType {
  isOpen: boolean;
  modalType: ModalType;
  initialData?: any;
  openModal: (type: ModalType, initialData?: any) => void;
  closeModal: (wasSaved?: boolean) => void;
}

const DataEntryModalContext = createContext<DataEntryModalContextType | undefined>(undefined);

export const useDataEntryModal = () => {
  const context = useContext(DataEntryModalContext);
  if (!context) {
    throw new Error('useDataEntryModal must be used within a DataEntryModalProvider');
  }
  return context;
};

export const DataEntryModalProvider = ({ children }: { children: ReactNode }) => {
  const [modalState, setModalState] = useState<ModalState>({ type: null, initialData: null });

  const openModal = useCallback((type: ModalType, initialData?: any) => {
    setModalState({ type, initialData });
  }, []);

  const closeModal = useCallback((wasSaved: boolean = false) => {
    if (typeof window !== 'undefined') {
        (window as any).__modalWasSaved = wasSaved;
    }
    setModalState({ type: null, initialData: null });
  }, []);

  const value = {
    isOpen: modalState.type !== null,
    modalType: modalState.type,
    initialData: modalState.initialData,
    openModal,
    closeModal,
  };

  return (
    <DataEntryModalContext.Provider value={value}>
      {children}
    </DataEntryModalContext.Provider>
  );
};

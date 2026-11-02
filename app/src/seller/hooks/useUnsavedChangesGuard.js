import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";

export function useUnsavedChangesGuard(dirty) {
  const navigation = useNavigation();
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    if (!dirty) return undefined;
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();
      setPendingAction(e.data.action);
      setShowExitConfirm(true);
    });
    return unsubscribe;
  }, [dirty, navigation]);

  const cancelExit = () => {
    setShowExitConfirm(false);
    setPendingAction(null);
  };

  const confirmExit = () => {
    setShowExitConfirm(false);
    if (pendingAction) navigation.dispatch(pendingAction);
    setPendingAction(null);
  };

  return { showExitConfirm, cancelExit, confirmExit };
}
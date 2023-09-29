const retryableFetch: typeof fetch = async (...args): Promise<Response> => {
  const response = await fetch(...args);
  if (response.status === 502) {
    await new Promise((resolve) => {
      setTimeout(resolve, Math.random() * 1000);
    });
    return retryableFetch(...args);
  }
  return response;
};

export default retryableFetch;

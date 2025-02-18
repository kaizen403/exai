"use client";

import React, { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import { ArrowRight, Info } from "lucide-react";

export default function UploadChat() {
  const [file, setFile] = useState<File | null>(null);
  const [inferredName, setInferredName] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const router = useRouter();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (
        selectedFile.type === "application/zip" ||
        selectedFile.name.endsWith(".zip")
      ) {
        setFile(selectedFile);
        setUploadStatus("");
        const baseName = selectedFile.name.replace(/\.zip$/i, "").trim();
        const dashIndex = baseName.lastIndexOf("-");
        if (dashIndex !== -1 && dashIndex < baseName.length - 1) {
          const name = baseName.slice(dashIndex + 1).trim();
          setInferredName(name);
          console.log("Inferred name:", name);
        } else {
          setInferredName("Unknown");
          console.log("Could not infer sender name; defaulting to 'Unknown'");
        }
      } else {
        setUploadStatus("Please upload a ZIP file.");
      }
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setUploadStatus("No file selected.");
      return;
    }
    try {
      setUploadStatus("Processing ZIP file...");
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      const txtFiles = Object.keys(zip.files).filter((name) =>
        name.endsWith("_chat.txt"),
      );
      if (txtFiles.length === 0) {
        setUploadStatus("No _chat.txt file found in the ZIP.");
        return;
      }
      const txtContent = await zip.file(txtFiles[0])?.async("string");
      if (!txtContent) {
        setUploadStatus("Error extracting text content.");
        return;
      }

      console.log("Extracted txtContent length:", txtContent.length);
      console.log("First 100 characters:", txtContent.substring(0, 100));

      setUploadStatus("Uploading extracted text...");
      const res = await fetch("http://13.233.105.76/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txtContent, senderName: inferredName }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Backend responded with error:", res.status, errorText);
        throw new Error(`Backend error ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      const sessionId = data.sessionId;
      if (!sessionId) {
        throw new Error("No sessionId returned from server.");
      }
      setUploadStatus("Upload successful! Redirecting...");
      router.push(
        `/chats?sessionId=${encodeURIComponent(sessionId)}&senderName=${encodeURIComponent(inferredName)}`,
      );
    } catch (error: unknown) {
      console.error("Upload error details:", error);
      if (error instanceof Error) {
        setUploadStatus("Upload failed: " + error.message);
      } else {
        setUploadStatus("Upload failed with an unknown error.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-200 flex flex-col items-center p-4 md:p-6 font-lexend">
      <div className="w-full max-w-4xl">
        {/* Heading Section */}
        <header className="text-center mb-8">
          <h1 className="text-5xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-400 to-gray-200">
            Exai
          </h1>
          <p className="mt-2 text-lg md:text-xl italic text-gray-400">
            bring memories back to life
          </p>
        </header>

        {/* Instructions Section */}
        <div className="mb-10 p-6 border border-gray-700 rounded-xl bg-gray-900 shadow-lg transition duration-300 hover:shadow-2xl">
          <div className="flex items-center mb-4">
            <Info className="mr-2" />
            <h2 className="text-2xl font-semibold">How to Use</h2>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-sm md:text-base">
            <li>
              <span className="font-medium">Export WhatsApp Chat:</span> Open
              WhatsApp on your phone, go to the desired chat, tap{" "}
              <span className="font-bold">More &gt; Export chat</span> (choose
              without media), and select <span className="font-bold">ZIP</span>{" "}
              as the file type.
            </li>
            <li>
              Transfer the exported ZIP file to your computer using email, cloud
              storage, or USB.
            </li>
            <li>
              Click the <span className="font-bold">Choose file</span> button
              below to select the ZIP file.
            </li>
            <li>
              The sender name will be automatically inferred from the file name.
            </li>
            <li>
              Click <span className="font-bold">Submit</span> to upload and
              process the file.
            </li>
          </ol>
        </div>

        {/* Form Section */}
        <div className="bg-gray-900 p-8 rounded-2xl shadow-lg border border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* File Input */}
            <div>
              <label className="block text-lg font-medium mb-2">
                ZIP File (must contain <code>_chat.txt</code>)
              </label>
              <input
                type="file"
                accept=".zip,application/zip"
                onChange={handleFileChange}
                className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-gray-800 file:text-white hover:file:bg-gray-700 transition-colors"
              />
            </div>

            {/* Display Inferred Sender Name */}
            {inferredName && (
              <div className="text-center text-lg font-semibold text-gray-300">
                You will now be talking to {inferredName} again : )
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-4 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition duration-300 font-medium"
            >
              Submit <ArrowRight />
            </button>

            {uploadStatus && (
              <p className="text-center text-sm text-gray-400">
                {uploadStatus}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

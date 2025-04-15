import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { MapPin, Phone, Mail, Loader2 } from "lucide-react";

export function ContactSection() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("naucalpan");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const emailData = {
      service_id: "service_8eixwyl",
      template_id: "template_54hur1o",
      user_id: "mf2Axd-oowtCmXbfk",
      template_params: {
        from_name: formData.name,
        reply_to: formData.email,
        subject: formData.subject,
        message: formData.message,
      },
    };

    try {
      const response = await fetch(
        "https://api.emailjs.com/api/v1.0/email/send",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(emailData),
        }
      );

      if (response.ok) {
        toast.success("Mensaje enviado exitosamente");
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        const errorData = await response.json();
        console.error("Error al enviar el correo:", errorData);
        toast.error("Error al enviar el mensaje");
      }
    } catch (error) {
      console.error("Error de red al enviar el mensaje:", error);
      toast.error("Ocurrió un error al enviar el correo");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      id="contact-section"
      className="py-[8vh] px-[4vw] sm:py-[6vh] sm:px-[2vw] bg-[#174ca7d3]"
    >
      <div className="w-full sm:max-w-[90vw] mx-auto">
        <h2 className="text-[7vw] sm:text-[3vw] md:text-[6vw] lg:text-[3vw] font-bold text-center mb-[6vh] sm:mb-[4vh] text-white">
          Contáctanos
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[8vw] lg:gap-[4vw]">
          <div>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col h-full space-y-[2vh]"
            >
              <Input
                type="text"
                name="name"
                placeholder="Nombre"
                value={formData.name}
                onChange={handleInputChange}
                className="bg-white text-[4vw] sm:text-[1vw] md:text-[2vw] lg:text-[1vw] p-[2vh] sm:p-[1.5vh] md:p-[2vh] lg:p-[1.5vh] h-[7vh] sm:h-[5vh] md:h-[7vh] lg:h-[5vh] rounded-md"
                required
              />
              <Input
                type="email"
                name="email"
                placeholder="Correo electrónico"
                value={formData.email}
                onChange={handleInputChange}
                className="bg-white text-[4vw] sm:text-[1vw] md:text-[2vw] lg:text-[1vw] p-[2vh] sm:p-[1.5vh] md:p-[2vh] lg:p-[1.5vh] h-[7vh] sm:h-[5vh] md:h-[7vh] lg:h-[5vh] rounded-md"
                required
              />
              <Input
                type="text"
                name="subject"
                placeholder="Asunto"
                value={formData.subject}
                onChange={handleInputChange}
                className="bg-white text-[4vw] sm:text-[1vw] md:text-[2vw] lg:text-[1vw] p-[2vh] sm:p-[1.5vh] md:p-[2vh] lg:p-[1.5vh] h-[7vh] sm:h-[5vh] md:h-[7vh] lg:h-[5vh] rounded-md"
                required
              />
              <Textarea
                name="message"
                placeholder="Mensaje"
                value={formData.message}
                onChange={handleInputChange}
                className="bg-white text-[4vw] sm:text-[1vw] md:text-[2vw] lg:text-[1vw] p-[2vh] sm:p-[1.5vh] md:p-[2vh] lg:p-[1.5vh] h-[20vh] sm:h-[15vh] md:h-[20vh] lg:h-[15vh] rounded-md flex-grow resize-none"
                required
              />
              <Button
                type="submit"
                disabled={isLoading}
                className={`w-full bg-[#174CA7] hover:bg-[#174CA7]/90 text-white text-[4vw] sm:text-[1.2vw] md:text-[2.2vw] lg:text-[1.2vw] py-[2.5vh] sm:py-[2vh] md:py-[2.5vh] lg:py-[3vh] ${
                  isLoading ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin w-[1.5em] h-[1.5em] mx-auto" />
                ) : (
                  "Enviar mensaje"
                )}
              </Button>
            </form>
          </div>
          <div className="space-y-[4vh]">
            <Card>
              <CardContent className="p-[4vw] sm:p-[2vw] md:p-[4vw] lg:p-[2vw] space-y-[4vh] sm:space-y-[2vh] md:space-y-[4vh] lg:space-y-[2vh]">
                <div className="flex justify-start mb-[2vh] gap-2">
                  <Button
                    onClick={() => setSelectedLocation("naucalpan")}
                    variant={
                      selectedLocation === "naucalpan" ? "default" : "outline"
                    }
                    className={`rounded-full text-[3vw] sm:text-[1vw] md:text-[1.8vw] lg:text-[1vw] px-[3vw] sm:px-[1.5vw] py-[1vh] ${
                      selectedLocation === "naucalpan"
                        ? "bg-[#174CA7] hover:bg-[#174CA7]/90 text-white"
                        : "hover:bg-gray-100 hover:text-[#174CA7]"
                    }`}
                  >
                    CDMX/Naucalpan
                  </Button>
                  <Button
                    onClick={() => setSelectedLocation("merida")}
                    variant={
                      selectedLocation === "merida" ? "default" : "outline"
                    }
                    className={`rounded-full text-[3vw] sm:text-[1vw] md:text-[1.8vw] lg:text-[1vw] px-[3vw] sm:px-[1.5vw] py-[1vh] ${
                      selectedLocation === "merida"
                        ? "bg-[#F1965B] hover:bg-[#F1965B]/90 text-white"
                        : "hover:bg-gray-100 hover:text-[#F1965B]"
                    }`}
                  >
                    Mérida
                  </Button>
                </div>

                {selectedLocation === "naucalpan" && (
                  <div className="space-y-[4vh] sm:space-y-[2vh]">
                    <div className="flex items-center gap-[4vw] sm:gap-[1vw] md:gap-[2vw] lg:gap-[1vw] text-[3.5vw] md:text-[2.4vw] lg:text-[1.2vw]">
                      <MapPin className="w-[12vw] h-[12vw] md:w-[4vw] md:h-[4vw] lg:w-[2.5vw] lg:h-[2.5vw] text-[#F1965B] mt-1" />
                      <div>
                        <p>
                          Av. 16 de Septiembre 5, Alce Blanco, C.P. 53370,
                          Naucalpan de Juárez, México.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-[4vw] sm:gap-[1vw] md:gap-[2vw] lg:gap-[1vw] text-[3.5vw] md:text-[2.4vw] lg:text-[1.2vw]">
                      <Phone className="w-[6vw] h-[6vw] md:w-[4vw] md:h-[4vw] lg:w-[2vw] lg:h-[2vw] text-[#F1965B] mt-1" />
                      <p>
                        999-926-2149 (Oficina)
                        <br />
                        999-491-5657 (WhatsApp)
                      </p>
                    </div>
                  </div>
                )}

                {selectedLocation === "merida" && (
                  <div className="space-y-[4vh] sm:space-y-[2vh]">
                    <div className="flex items-center gap-[4vw] sm:gap-[1vw] md:gap-[2vw] lg:gap-[1vw] text-[3.5vw] md:text-[2.4vw] lg:text-[1.2vw]">
                      <MapPin className="w-[12vw] h-[12vw] md:w-[4vw] md:h-[4vw] lg:w-[2.5vw] lg:h-[2.5vw] text-[#F1965B] mt-1" />
                      <div>
                        <p>
                          Calle 40 número 501 local O entre 61 y 63 colonia
                          centro, Mérida, Mexico, 97000
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-[4vw] sm:gap-[1vw] md:gap-[2vw] lg:gap-[1vw] text-[3.5vw] md:text-[2.4vw] lg:text-[1.2vw]">
                      <Phone className="w-[6vw] h-[6vw] md:w-[4vw] md:h-[4vw] lg:w-[2vw] lg:h-[2vw] text-[#F1965B] mt-1" />
                      <p>
                        999-926-2149 (Oficina)
                        <br />
                        999-491-5657 (WhatsApp)
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-[4vw] sm:gap-[1vw] md:gap-[2vw] lg:gap-[1vw] text-[3.5vw] md:text-[2.4vw] lg:text-[1.2vw] pt-[1vh]">
                  <Mail className="w-[6vw] h-[6vw] md:w-[4vw] md:h-[4vw] lg:w-[2vw] lg:h-[2vw] text-[#F1965B] mt-1" />
                  <p>administracion@telasytejidosluciana.com</p>
                </div>
              </CardContent>
            </Card>
            <div className="aspect-video relative rounded-lg overflow-hidden hidden lg:block shadow-[0_2px_10px_rgba(0,0,0,0.2)]">
              <Image
                src={
                  selectedLocation === "naucalpan"
                    ? "/images/map.png"
                    : "/images/map-merida.png"
                }
                alt={`Mapa de ubicación en ${
                  selectedLocation === "naucalpan" ? "Naucalpan" : "Mérida"
                }`}
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

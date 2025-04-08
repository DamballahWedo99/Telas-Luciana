export default function PoliticaDePrivacidad() {
  return (
    <div className="py-[8vh] px-[6vw] sm:py-[6vh] sm:px-[4vw]">
      <div className="w-full max-w-[80vw] lg:max-w-[70vw] mx-auto">
        <h1 className="text-[8vw] sm:text-[6vw] md:text-[4vw] lg:text-[3vw] font-bold text-center mb-[6vh] text-[#174CA7]">
          Política de Privacidad
        </h1>
        <div className="space-y-[4vh] text-[3.8vw] sm:text-[2.2vw] md:text-[2vw] lg:text-[1.2vw] text-gray-700">
          <p>
            En Telas y Tejidos Luciana, valoramos y respetamos su privacidad.
            Esta Política de Privacidad describe cómo recopilamos, utilizamos y
            protegemos su información personal cuando utiliza nuestro sitio web
            y nuestros servicios.
          </p>

          <h2 className="text-[6vw] sm:text-[4vw] md:text-[3vw] lg:text-[2vw] font-semibold text-[#174CA7] mt-[4vh]">
            1. Información que recopilamos
          </h2>
          <p>
            Recopilamos información que usted nos proporciona directamente, como
            su nombre, dirección de correo electrónico, número de teléfono y
            dirección postal cuando realiza un pedido o se pone en contacto con
            nosotros.
          </p>

          <h2 className="text-[6vw] sm:text-[4vw] md:text-[3vw] lg:text-[2vw] font-semibold text-[#174CA7] mt-[4vh]">
            2. Uso de la información
          </h2>
          <p>
            Utilizamos la información recopilada para procesar sus pedidos,
            responder a sus consultas y mejorar nuestros productos y servicios.
            No compartimos su información personal con terceros, excepto cuando
            sea necesario para cumplir con obligaciones legales o procesar sus
            pedidos.
          </p>

          <h2 className="text-[6vw] sm:text-[4vw] md:text-[3vw] lg:text-[2vw] font-semibold text-[#174CA7] mt-[4vh]">
            3. Protección de datos
          </h2>
          <p>
            Implementamos medidas de seguridad técnicas y organizativas para
            proteger su información personal contra accesos no autorizados,
            pérdida o alteración.
          </p>

          <h2 className="text-[6vw] sm:text-[4vw] md:text-[3vw] lg:text-[2vw] font-semibold text-[#174CA7] mt-[4vh]">
            4. Sus derechos
          </h2>
          <p>
            Usted tiene derecho a acceder, corregir o eliminar su información
            personal. Si desea ejercer estos derechos o tiene alguna pregunta
            sobre nuestra política de privacidad, por favor contáctenos a través
            de nuestro formulario de contacto o enviando un correo electrónico a
            info@telasluciana.com.
          </p>

          <h2 className="text-[6vw] sm:text-[4vw] md:text-[3vw] lg:text-[2vw] font-semibold text-[#174CA7] mt-[4vh]">
            5. Cambios en la política de privacidad
          </h2>
          <p>
            Nos reservamos el derecho de modificar esta política de privacidad
            en cualquier momento. Cualquier cambio será publicado en esta página
            y, si son significativos, le notificaremos por correo electrónico.
          </p>

          <p className="mt-[6vh]">
            Última actualización:{" "}
            {new Date().toLocaleDateString("es-MX", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
